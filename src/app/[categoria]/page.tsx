import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NegocioCard from "@/components/home/NegocioCard";
import EstadoVacio from "@/components/home/EstadoVacio";
import { createClient } from "@/lib/supabase/server";
import { calcularPuntuacionMedia } from "@/lib/resenas";
import { getUsuarioYFavoritos } from "@/lib/favoritos";
import { getCategoriaPorSlug } from "@/lib/categorias";
import GridStagger from "@/components/motion/GridStagger";
import type { Categoria } from "@/types";

// Copy editorial por categoría (párrafo de cabecera + meta description).
// No sale de `categorias` porque esa tabla no tiene columna de
// descripción larga; el título y la validez de la ruta sí se resuelven
// contra la tabla (ver getCategoriaPorSlug), así que añadir/quitar una
// categoría en BD no requiere tocar código salvo, opcionalmente, este
// texto.
const DESCRIPCIONES: Record<string, string> = {
  gastronomia:
    "Bares, restaurantes y rincones donde probar la cocina jiennense, del tapeo al aceite de oliva virgen extra.",
  cultura:
    "Monumentos, museos y actividades culturales para conocer la historia y el arte de Jaén.",
  naturaleza:
    "Turismo rural, senderos y espacios naturales alrededor de la capital jiennense.",
  tiendas: "Comercio local y tiendas con identidad propia en Jaén capital.",
  experiencias:
    "Planes y actividades de ocio para vivir Jaén de una forma distinta.",
};

const PAGE_SIZE = 12;
// Tope de filas al ordenar por "mejor valorados" (ver getNegocios). No es
// paginación real en SQL, así que hace falta un límite razonable.
const CAP_VALORACION = 300;

const ORDENES = [
  { valor: "relevancia", etiqueta: "Relevancia" },
  { valor: "valoracion", etiqueta: "Mejor valorados" },
  { valor: "recientes", etiqueta: "Más recientes" },
] as const;

type OrdenValor = (typeof ORDENES)[number]["valor"];

interface NegocioRow {
  id: string;
  nombre: string;
  slug: string;
  descripcion_corta: string | null;
  imagen_portada: string | null;
  google_photo_name: string | null;
  google_photo_atribucion: string | null;
  categoria: { nombre: string } | null;
  resenas: { puntuacion: number }[];
}

function aTarjeta(negocio: NegocioRow) {
  return {
    id: negocio.id,
    slug: negocio.slug,
    nombre: negocio.nombre,
    descripcion_corta: negocio.descripcion_corta,
    imagen_portada: negocio.imagen_portada,
    google_photo_name: negocio.google_photo_name,
    google_photo_atribucion: negocio.google_photo_atribucion,
    categoriaNombre: negocio.categoria?.nombre,
    puntuacion_media: calcularPuntuacionMedia(negocio.resenas),
  };
}

async function getNegocios(
  tipo: Categoria["tipo"],
  orden: OrdenValor,
  pagina: number,
  zona: string | null
) {
  console.time("[perf] getNegocios"); // TEMPORAL: quitar tras medir
  try {
  const supabase = await createClient();
  const SELECT =
    "id, nombre, slug, descripcion_corta, imagen_portada, google_photo_name, google_photo_atribucion, categoria:categorias!inner(nombre, tipo), resenas(puntuacion)";

  if (orden === "valoracion") {
    // No existe una columna puntuacion_media en negocios (es un valor
    // calculado a partir de resenas), así que aquí no se puede resolver
    // el order()/range() en la propia consulta SQL: hay que traer un
    // conjunto acotado y ordenar en memoria, igual que en
    // BentoDestacados.tsx. Si el catálogo crece mucho, esto debería
    // sustituirse por una vista con avg(puntuacion) para paginar de
    // verdad en la base de datos.
    let query = supabase
      .from("negocios")
      .select(SELECT)
      .eq("categoria.tipo", tipo)
      .limit(CAP_VALORACION);

    if (zona) query = query.eq("zona", zona);

    const { data, error } = await query.returns<NegocioRow[]>();

    if (error || !data) return { negocios: [], total: 0 };

    const ordenados = data
      .map(aTarjeta)
      .sort((a, b) => (b.puntuacion_media ?? 0) - (a.puntuacion_media ?? 0));

    const desde = (pagina - 1) * PAGE_SIZE;
    return {
      negocios: ordenados.slice(desde, desde + PAGE_SIZE),
      total: ordenados.length,
    };
  }

  const desde = (pagina - 1) * PAGE_SIZE;
  let query = supabase
    .from("negocios")
    .select(SELECT, { count: "exact" })
    .eq("categoria.tipo", tipo);

  if (zona) query = query.eq("zona", zona);

  query =
    orden === "recientes"
      ? query.order("created_at", { ascending: false })
      : query.order("destacado", { ascending: false }).order("nombre", { ascending: true });

  const { data, error, count } = await query
    .range(desde, desde + PAGE_SIZE - 1)
    .returns<NegocioRow[]>();

  if (error || !data) return { negocios: [], total: 0 };

  return { negocios: data.map(aTarjeta), total: count ?? data.length };
  } finally {
    console.timeEnd("[perf] getNegocios"); // TEMPORAL
  }
}

// Zonas disponibles para el desplegable: solo las que existan de verdad
// entre los negocios de la categoría (distinct en memoria — Postgrest no
// tiene un DISTINCT nativo desde supabase-js). No la lista orientativa de
// la migración, que es solo una sugerencia para quien dé de alta negocios.
async function getZonasDisponibles(tipo: Categoria["tipo"]) {
  console.time("[perf] getZonasDisponibles"); // TEMPORAL: quitar tras medir
  try {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("negocios")
    .select("zona, categoria:categorias!inner(tipo)")
    .eq("categoria.tipo", tipo)
    .not("zona", "is", null)
    .returns<{ zona: string | null }[]>();

  if (error || !data) return [];

  const unicas = new Set(
    data.map((n) => n.zona).filter((z): z is string => Boolean(z))
  );
  return [...unicas].sort((a, b) => a.localeCompare(b, "es"));
  } finally {
    console.timeEnd("[perf] getZonasDisponibles"); // TEMPORAL
  }
}

interface PageProps {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<{ orden?: string; pagina?: string; zona?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { categoria } = await params;
  const info = await getCategoriaPorSlug(categoria);
  if (!info) return {};

  return {
    title: `${info.nombre} · Jaén Guía`,
    description: DESCRIPCIONES[info.slug],
  };
}

export default async function CategoriaPage({ params, searchParams }: PageProps) {
  const { categoria } = await params;
  const info = await getCategoriaPorSlug(categoria);
  if (!info) notFound();

  const sp = await searchParams;

  const orden: OrdenValor = ORDENES.some((o) => o.valor === sp.orden)
    ? (sp.orden as OrdenValor)
    : "relevancia";
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const zonaSeleccionada = sp.zona || null;

  const [{ negocios, total }, zonasDisponibles, { favoritoIds }] = await Promise.all([
    getNegocios(info.tipo, orden, pagina, zonaSeleccionada),
    getZonasDisponibles(info.tipo),
    getUsuarioYFavoritos(),
  ]);
  const negociosConFavorito = negocios.map((negocio) => ({
    ...negocio,
    esFavorito: favoritoIds.has(negocio.id),
  }));
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hrefConParams = (nuevosParams: Record<string, string | number>) => {
    const base: Record<string, string> = zonaSeleccionada
      ? { zona: zonaSeleccionada }
      : {};
    const query = new URLSearchParams({
      ...base,
      ...Object.fromEntries(
        Object.entries(nuevosParams).map(([k, v]) => [k, String(v)])
      ),
    });
    return `/${categoria}?${query.toString()}`;
  };


  return (
    <>
      <main className="min-h-screen bg-tierra-50 pb-24">
        {/* Cabecera monumental */}
        <header className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-24">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
          <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
            <h1 className="font-display text-6xl md:text-[100px] leading-[0.85] tracking-tight text-oliva-900 mb-6">
              {info.nombre}
            </h1>
            <p className="mx-auto max-w-2xl text-lg md:text-xl text-oliva-700">
              {DESCRIPCIONES[categoria]}
            </p>
          </div>
        </header>

        {/* Barra de filtros flotante/sticky tipo glass */}
        <div className="sticky top-[73px] z-30 mx-auto max-w-6xl px-6 mb-12">
          <div className="rounded-[1.5rem] bg-white/70 backdrop-blur-xl p-2 md:p-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white ring-1 ring-black/[0.03] flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center gap-3 px-2">
              <span className="text-xs font-bold uppercase tracking-wider text-oliva-400">
                Ordenar
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ORDENES.map((o) => {
                  const activo = orden === o.valor;
                  return (
                    <Link
                      key={o.valor}
                      href={hrefConParams({ orden: o.valor, pagina: 1 })}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                        activo
                          ? "bg-oliva-900 text-white shadow-sm"
                          : "bg-transparent text-oliva-600 hover:bg-white hover:text-oliva-900"
                      }`}
                    >
                      {o.etiqueta}
                    </Link>
                  );
                })}
              </div>
            </div>

            {zonasDisponibles.length > 0 && (
              <form
                method="get"
                action={`/${categoria}`}
                className="flex items-center gap-3 px-2 border-t border-oliva-100/50 pt-3 md:pt-0 md:border-t-0 md:border-l"
              >
                <input type="hidden" name="orden" value={orden} />
                <label htmlFor="zona" className="sr-only">Zona</label>
                <select
                  id="zona"
                  name="zona"
                  defaultValue={zonaSeleccionada ?? ""}
                  className="rounded-full bg-white/50 px-4 py-2 text-sm font-medium text-oliva-900 outline-none ring-1 ring-oliva-100 focus:ring-2 focus:ring-terracota-400 transition-shadow appearance-none cursor-pointer"
                >
                  <option value="">Todas las zonas</option>
                  {zonasDisponibles.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-full bg-terracota-500 px-5 py-2 text-sm font-bold text-white hover:bg-terracota-600 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Filtrar
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6">
          {negocios.length === 0 ? (
            <EstadoVacio mensaje={`Aún no hay negocios en ${info.nombre.toLowerCase()}`} />
          ) : (
            <>
              <GridStagger key={`${orden}-${zonaSeleccionada}-${pagina}`} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {negociosConFavorito.map((negocio, i) => (
                  <NegocioCard
                    key={negocio.slug}
                    negocio={negocio}
                    rutaActual={`/${categoria}`}
                    index={i}
                  />
                ))}
              </GridStagger>

              {/* Paginación refinada */}
              {totalPaginas > 1 && (
                <div className="mt-16 flex items-center justify-center gap-6">
                  {pagina > 1 ? (
                    <Link
                      href={hrefConParams({ orden, pagina: pagina - 1 })}
                      className="rounded-full border border-oliva-100 bg-white px-6 py-2.5 text-sm font-bold text-oliva-900 hover:border-oliva-900 hover:bg-oliva-900 hover:text-white transition-all shadow-sm"
                    >
                      Anterior
                    </Link>
                  ) : (
                    <span className="rounded-full border border-oliva-100 bg-white/50 px-6 py-2.5 text-sm font-medium text-oliva-400 cursor-not-allowed">
                      Anterior
                    </span>
                  )}

                  <span className="text-sm font-semibold text-oliva-600 tracking-wide">
                    {pagina} / {totalPaginas}
                  </span>

                  {pagina < totalPaginas ? (
                    <Link
                      href={hrefConParams({ orden, pagina: pagina + 1 })}
                      className="rounded-full bg-oliva-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-terracota-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
                    >
                      Siguiente
                    </Link>
                  ) : (
                    <span className="rounded-full border border-oliva-100 bg-white/50 px-6 py-2.5 text-sm font-medium text-oliva-400 cursor-not-allowed">
                      Siguiente
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
