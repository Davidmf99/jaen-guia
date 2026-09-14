import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { notFound } from "next/navigation";
import NegocioCard from "@/components/home/NegocioCard";
import EstadoVacio from "@/components/home/EstadoVacio";
import { createClient } from "@/lib/supabase/server";
import { calcularPuntuacionMedia } from "@/lib/resenas";
import { getUsuarioYFavoritos } from "@/lib/favoritos";
import { getCategoriaPorSlug } from "@/lib/categorias";
import GridStagger from "@/components/motion/GridStagger";
import { SERVICIOS } from "@/lib/servicios";
import { estaAbierto } from "@/lib/horario";
import { esNegocio, esTipoNegocio } from "@/lib/categorias";
import type { Categoria } from "@/types";
import { JsonLd, SEO_CATEGORIA, listaJsonLd, migasJsonLd, tituloCategoria } from "@/lib/seo";

// Copy editorial por categoría (párrafo de cabecera + meta description).
// No sale de `categorias` porque esa tabla no tiene columna de
// descripción larga; el título y la validez de la ruta sí se resuelven
// contra la tabla (ver getCategoriaPorSlug), así que añadir/quitar una
// categoría en BD no requiere tocar código salvo, opcionalmente, el
// texto de SEO_CATEGORIA (título y descripción viven juntos en lib/seo).
const DESCRIPCIONES: Record<string, string> = Object.fromEntries(
  Object.entries(SEO_CATEGORIA).map(([slug, v]) => [slug, v.descripcion])
);

const PAGE_SIZE = 12;
// Tope de filas al ordenar por "mejor valorados" (ver getNegocios). No es
// paginación real en SQL, así que hace falta un límite razonable.
const CAP_VALORACION = 300;

const ORDENES = [
  { valor: "relevancia", etiqueta: "Recomendados" },
  { valor: "valoracion", etiqueta: "Mejor valorados" },
  { valor: "recientes", etiqueta: "Más recientes" },
] as const;

type OrdenValor = (typeof ORDENES)[number]["valor"];

// Chips de filtro por servicio (negocios.servicios, migración 0010).
// No todos los del catálogo: solo los que alguien usa para decidir
// "dónde voy ahora". Por tipo de categoría, porque "menú del día" en
// Naturaleza no significa nada.
const FILTROS_SERVICIO: Record<Categoria["tipo"], string[]> = {
  comer_beber: ["terraza", "reservas", "menu_dia", "desayunos", "para_llevar", "a_domicilio", "ninos", "mascotas", "accesible"],
  ocio: ["reservas", "ninos", "mascotas", "accesible", "parking"],
  tienda: ["a_domicilio", "tarjeta", "accesible", "parking"],
  cultura: ["ninos", "accesible", "parking"],
  naturaleza: ["ninos", "mascotas", "accesible", "parking"],
};

// Tope de filas cuando hay que filtrar en memoria ("abierto ahora" se
// decide en JS a partir del jsonb de horario). Mismo criterio que
// CAP_VALORACION.
const CAP_FILTRO_MEMORIA = 400;

interface Filtros {
  zona: string | null;
  servicios: string[];
  abiertoAhora: boolean;
}

interface NegocioRow {
  id: string;
  nombre: string;
  slug: string;
  descripcion_corta: string | null;
  imagen_portada: string | null;
  google_photo_name: string | null;
  google_photo_atribucion: string | null;
  horario: Record<string, string> | null;
  tipo_cocina: string[] | null;
  es_destacado: boolean;
  categoria: { nombre: string; tipo: Categoria["tipo"] } | null;
  resenas: { puntuacion: number }[];
}

function aTarjeta(negocio: NegocioRow, ahora: Date) {
  const conHorario = esNegocio(negocio);
  return {
    id: negocio.id,
    slug: negocio.slug,
    nombre: negocio.nombre,
    descripcion_corta: negocio.descripcion_corta,
    imagen_portada: negocio.imagen_portada,
    google_photo_name: negocio.google_photo_name,
    google_photo_atribucion: negocio.google_photo_atribucion,
    categoriaNombre: negocio.categoria?.nombre,
    destacado: negocio.es_destacado,
    puntuacion_media: calcularPuntuacionMedia(negocio.resenas),
    // undefined = la tarjeta no pinta nada (naturaleza).
    abiertoAhora: conHorario ? estaAbierto(negocio.horario, ahora) : undefined,
  };
}

async function getNegocios(
  tipo: Categoria["tipo"],
  orden: OrdenValor,
  pagina: number,
  filtros: Filtros
) {
  const supabase = await createClient();
  const ahora = new Date();
  const SELECT =
    "id, nombre, slug, descripcion_corta, imagen_portada, google_photo_name, google_photo_atribucion, horario, tipo_cocina, es_destacado, categoria:categorias!inner(nombre, tipo), resenas(puntuacion)";

  // "Abierto ahora" se decide en JS (el horario es jsonb con texto tipo
  // "12:00–24:00"), y "mejor valorados" ordena por un valor calculado a
  // partir de resenas: en los dos casos no se puede paginar en SQL, así
  // que se trae un conjunto acotado y se filtra/ordena en memoria, igual
  // que en BentoDestacados.tsx. Si el catálogo crece mucho, esto debería
  // sustituirse por columnas/vistas materializadas para paginar de
  // verdad en la base de datos.
  if (orden === "valoracion" || filtros.abiertoAhora) {
    let query = supabase
      .from("negocios")
      .select(SELECT)
      .eq("categoria.tipo", tipo)
      .order("es_destacado", { ascending: false })
      .order(orden === "recientes" ? "created_at" : "nombre", { ascending: orden !== "recientes" })
      .limit(Math.max(CAP_VALORACION, CAP_FILTRO_MEMORIA));
    if (filtros.zona) query = query.eq("zona", filtros.zona);
    // servicios @> array: el negocio tiene TODOS los marcados.
    if (filtros.servicios.length > 0) query = query.contains("servicios", filtros.servicios);

    const { data, error } = await query.returns<NegocioRow[]>();
    if (error || !data) return { negocios: [], total: 0 };

    let lista = data.map((n) => aTarjeta(n, ahora));
    if (filtros.abiertoAhora) lista = lista.filter((n) => n.abiertoAhora === true);
    if (orden === "valoracion") {
      lista.sort((a, b) => (b.puntuacion_media ?? 0) - (a.puntuacion_media ?? 0));
    }

    const desde = (pagina - 1) * PAGE_SIZE;
    return {
      negocios: lista.slice(desde, desde + PAGE_SIZE),
      total: lista.length,
    };
  }

  const desde = (pagina - 1) * PAGE_SIZE;
  let query = supabase
    .from("negocios")
    .select(SELECT, { count: "exact" })
    .eq("categoria.tipo", tipo);
  if (filtros.zona) query = query.eq("zona", filtros.zona);
  if (filtros.servicios.length > 0) query = query.contains("servicios", filtros.servicios);

  query =
    orden === "recientes"
      ? query.order("created_at", { ascending: false })
      : query.order("es_destacado", { ascending: false }).order("nombre", { ascending: true });

  const { data, error, count } = await query
    .range(desde, desde + PAGE_SIZE - 1)
    .returns<NegocioRow[]>();

  if (error || !data) return { negocios: [], total: 0 };

  return { negocios: data.map((n) => aTarjeta(n, ahora)), total: count ?? data.length };
}

// Zonas disponibles para el desplegable: solo las que existan de verdad
// entre los negocios de la categoría (distinct en memoria — Postgrest no
// tiene un DISTINCT nativo desde supabase-js). No la lista orientativa de
// la migración, que es solo una sugerencia para quien dé de alta negocios.
async function getZonasDisponibles(tipo: Categoria["tipo"]) {
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
}

interface PageProps {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<{
    orden?: string;
    pagina?: string;
    zona?: string;
    /** Claves de servicio separadas por coma: ?servicios=terraza,reservas */
    servicios?: string;
    /** ?abierto=1 */
    abierto?: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { categoria } = await params;
  const info = await getCategoriaPorSlug(categoria);
  if (!info) return {};

  return {
    title: `${tituloCategoria(info.slug, info.nombre)} · Jaén Guía`,
    description: DESCRIPCIONES[info.slug],
    // Filtros, orden y paginación son la misma página para Google.
    alternates: { canonical: `/${info.slug}` },
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
  const chipsServicio = FILTROS_SERVICIO[info.tipo]
    .map((clave) => SERVICIOS.find((s) => s.clave === clave))
    .filter((s): s is (typeof SERVICIOS)[number] => Boolean(s));
  const serviciosSeleccionados = (sp.servicios ?? "")
    .split(",")
    .filter((clave) => chipsServicio.some((s) => s.clave === clave));
  // En naturaleza no hay chip de "abierto ahora" y el parámetro se ignora.
  const filtraApertura = esTipoNegocio(info.tipo);
  const abiertoAhora = filtraApertura && sp.abierto === "1";
  const filtros: Filtros = { zona: zonaSeleccionada, servicios: serviciosSeleccionados, abiertoAhora };
  const hayFiltros = abiertoAhora || serviciosSeleccionados.length > 0 || Boolean(zonaSeleccionada);

  const [{ negocios, total }, zonasDisponibles, { favoritoIds }] = await Promise.all([
    getNegocios(info.tipo, orden, pagina, filtros),
    getZonasDisponibles(info.tipo),
    getUsuarioYFavoritos(),
  ]);
  const negociosConFavorito = negocios.map((negocio) => ({
    ...negocio,
    esFavorito: favoritoIds.has(negocio.id),
  }));
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Construye la URL conservando los filtros activos; un valor vacío
  // quita ese parámetro.
  const hrefConParams = (nuevosParams: Record<string, string | number>) => {
    const base: Record<string, string> = {};
    if (zonaSeleccionada) base.zona = zonaSeleccionada;
    if (serviciosSeleccionados.length > 0) base.servicios = serviciosSeleccionados.join(",");
    if (abiertoAhora) base.abierto = "1";
    if (orden !== "relevancia") base.orden = orden;
    const query = new URLSearchParams(base);
    for (const [k, v] of Object.entries(nuevosParams)) {
      if (v === "" || (k === "pagina" && Number(v) <= 1)) query.delete(k);
      else query.set(k, String(v));
    }
    const qs = query.toString();
    return qs ? `/${categoria}?${qs}` : `/${categoria}`;
  };

  const hrefServicio = (clave: string) => {
    const activo = serviciosSeleccionados.includes(clave);
    const nuevos = activo
      ? serviciosSeleccionados.filter((c) => c !== clave)
      : [...serviciosSeleccionados, clave];
    return hrefConParams({ servicios: nuevos.join(","), pagina: 1 });
  };


  return (
    <>
      <JsonLd
        data={[
          migasJsonLd([{ nombre: "Inicio", ruta: "/" }, { nombre: info.nombre, ruta: `/${info.slug}` }]),
          listaJsonLd(
            tituloCategoria(info.slug, info.nombre),
            negocios.map((n) => ({ nombre: n.nombre, ruta: `/negocio/${n.slug}` }))
          ),
        ]}
      />
      <main className="min-h-screen bg-tierra-50 pb-24">
        {/* Cabecera monumental */}
        <header className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-24">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('/noise.svg')]" />
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
        <div className="sticky top-[var(--alto-cabecera)] z-30 mx-auto max-w-6xl px-6 mb-12">
          <div className="rounded-[1.5rem] bg-white/70 backdrop-blur-xl p-2 md:p-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white ring-1 ring-black/[0.03] flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center gap-3 px-2">
              <span className="text-sm font-bold uppercase tracking-wider text-oliva-600">
                Ordenar
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ORDENES.map((o) => {
                  const activo = orden === o.valor;
                  return (
                    <Link
                      key={o.valor}
                      href={hrefConParams({ orden: o.valor, pagina: 1 })}
                      className={`inline-flex min-h-11 items-center rounded-full px-4 text-base font-semibold transition-all ${
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
                {serviciosSeleccionados.length > 0 && (
                  <input type="hidden" name="servicios" value={serviciosSeleccionados.join(",")} />
                )}
                {abiertoAhora && <input type="hidden" name="abierto" value="1" />}
                <label htmlFor="zona" className="sr-only">Zona</label>
                {/* appearance-none quitaba la flecha del sistema y dejaba
                    el desplegable idéntico a los chips de "Ordenar" de al
                    lado: nada decía que se pudiera desplegar. Se repone
                    con un chevron dibujado y sitio para él a la derecha. */}
                <div className="relative">
                  <select
                    id="zona"
                    name="zona"
                    defaultValue={zonaSeleccionada ?? ""}
                    className="w-full rounded-full bg-white/50 min-h-11 pl-4 pr-10 text-base font-medium text-oliva-900 outline-none ring-1 ring-oliva-100 focus:ring-2 focus:ring-terracota-400 transition-shadow appearance-none cursor-pointer"
                  >
                    <option value="">Todas las zonas</option>
                    {zonasDisponibles.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-oliva-600"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-full bg-terracota-600 min-h-11 px-5 text-base font-bold text-white hover:bg-terracota-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Filtrar
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6">
          {/* Chips de filtro: enlaces, no formulario, para que funcionen
              sin JS y cada combinación tenga URL propia (compartible). */}
          <nav aria-label="Filtros" className="-mt-4 mb-10 flex flex-wrap items-center gap-2">
            {filtraApertura && (
            <Link
              href={hrefConParams({ abierto: abiertoAhora ? "" : "1", pagina: 1 })}
              aria-pressed={abiertoAhora}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-base font-semibold transition-colors ${
                abiertoAhora
                  ? "border-oliva-900 bg-oliva-900 text-white"
                  : "border-oliva-100 bg-white text-oliva-900 hover:border-oliva-900"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-full ${abiertoAhora ? "bg-white" : "bg-oliva-500"}`}
              />
              Abierto ahora
            </Link>
            )}
            {chipsServicio.map(({ clave, etiqueta, icono: Icono }) => {
              const activo = serviciosSeleccionados.includes(clave);
              return (
                <Link
                  key={clave}
                  href={hrefServicio(clave)}
                  aria-pressed={activo}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-base font-semibold transition-colors ${
                    activo
                      ? "border-oliva-900 bg-oliva-900 text-white"
                      : "border-oliva-100 bg-white text-oliva-900 hover:border-oliva-900"
                  }`}
                >
                  <Icono size={16} aria-hidden="true" className={activo ? "text-white" : "text-terracota-500"} />
                  {etiqueta}
                </Link>
              );
            })}
            {hayFiltros && (
              <Link
                href={orden === "relevancia" ? `/${categoria}` : `/${categoria}?orden=${orden}`}
                className="inline-flex min-h-11 items-center px-3 text-base font-semibold text-terracota-600 hover:underline"
              >
                Quitar filtros
              </Link>
            )}
          </nav>

          {negocios.length === 0 ? (
            <EstadoVacio
              mensaje={
                hayFiltros
                  ? "Nada con esos filtros ahora mismo. Prueba a quitar alguno."
                  : `Aún no hay negocios en ${info.nombre.toLowerCase()}`
              }
            />
          ) : (
            <>
              <GridStagger key={`${orden}-${zonaSeleccionada}-${serviciosSeleccionados.join(",")}-${abiertoAhora}-${pagina}`} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {negociosConFavorito.map((negocio) => (
                  <NegocioCard
                    key={negocio.slug}
                    negocio={negocio}
                    rutaActual={`/${categoria}`}
                  />
                ))}
              </GridStagger>

              {/* Paginación refinada */}
              {totalPaginas > 1 && (
                <div className="mt-16 flex items-center justify-center gap-6">
                  {pagina > 1 ? (
                    <Link
                      href={hrefConParams({ orden, pagina: pagina - 1 })}
                      className="rounded-full border border-oliva-100 bg-white min-h-11 inline-flex items-center px-6 text-base font-bold text-oliva-900 hover:border-oliva-900 hover:bg-oliva-900 hover:text-white transition-all shadow-sm"
                    >
                      Anterior
                    </Link>
                  ) : (
                    <span className="rounded-full border border-oliva-100 bg-white/50 min-h-11 inline-flex items-center px-6 text-base font-medium text-oliva-600 cursor-not-allowed">
                      Anterior
                    </span>
                  )}

                  <span className="text-base font-semibold text-oliva-700 tracking-wide">
                    Página {pagina} de {totalPaginas}
                  </span>

                  {pagina < totalPaginas ? (
                    <Link
                      href={hrefConParams({ orden, pagina: pagina + 1 })}
                      className="rounded-full bg-oliva-900 min-h-11 inline-flex items-center px-6 text-base font-bold text-white hover:bg-terracota-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
                    >
                      Siguiente
                    </Link>
                  ) : (
                    <span className="rounded-full border border-oliva-100 bg-white/50 min-h-11 inline-flex items-center px-6 text-base font-medium text-oliva-600 cursor-not-allowed">
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
