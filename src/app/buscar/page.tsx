import type { Metadata } from "next";
import Link from "next/link";
import { Search, SearchX } from "lucide-react";
import NegocioCard from "@/components/home/NegocioCard";
import GridStagger from "@/components/motion/GridStagger";
import { createClient } from "@/lib/supabase/server";
import { calcularPuntuacionMedia } from "@/lib/resenas";
import { getUsuarioYFavoritos } from "@/lib/favoritos";

// Sin loading.tsx a propósito: cualquier loading.tsx en la cadena de un
// segmento obliga a responder en streaming y deja el estado HTTP fijado
// en 200 (ver el commit que quitó los tres que había).

// Tope de resultados. La búsqueda es un ilike sin paginar; con 442
// negocios el peor caso cabe de sobra, pero conviene no dejarlo abierto.
const MAX_RESULTADOS = 60;
const MAX_LONGITUD_CONSULTA = 80;

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

/**
 * Normaliza lo que escribe el usuario antes de meterlo en un ilike.
 * Se quitan los comodines de LIKE: un "%" suelto haría que la búsqueda
 * devolviera el catálogo entero, y un "_" casaría con cualquier letra.
 */

// Misma regla que public.normaliza_texto en la base (migración 0020):
// sin tildes ni ñ, minúsculas, y cualquier signo pasa a un espacio. Si
// no coinciden las dos, "Bar El Abuelo" no encuentra a "Bar «El Abuelo»".
function normalizaTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function limpiarConsulta(bruta: string | undefined) {
  if (!bruta) return "";
  return bruta.trim().slice(0, MAX_LONGITUD_CONSULTA).replace(/[%_]/g, "");
}


async function buscarNegocios(consulta: string) {
  const supabase = await createClient();
  
  // Buscamos tanto en nombre original como en normalizado por seguridad
  const searchTerm = `%${consulta}%`;
  const normalizedTerm = `%${normalizaTexto(consulta)}%`;
  
  const { data, error } = await supabase
    .from("negocios")
    .select(
      "id, nombre, slug, descripcion_corta, imagen_portada, google_photo_name, google_photo_atribucion, categoria:categorias(nombre), resenas(puntuacion)"
    )
    .or(`nombre.ilike.${searchTerm},nombre_normalizado.ilike.${normalizedTerm}`)
    .order("nombre", { ascending: true })
    .limit(MAX_RESULTADOS)
    .returns<NegocioRow[]>();

  if (error || !data) return [];


  return data.map((negocio) => ({
    id: negocio.id,
    slug: negocio.slug,
    nombre: negocio.nombre,
    descripcion_corta: negocio.descripcion_corta,
    imagen_portada: negocio.imagen_portada,
    google_photo_name: negocio.google_photo_name,
    google_photo_atribucion: negocio.google_photo_atribucion,
    categoriaNombre: negocio.categoria?.nombre,
    puntuacion_media: calcularPuntuacionMedia(negocio.resenas),
  }));
}

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const consulta = limpiarConsulta(q);
  return {
    title: consulta
      ? `Buscar "${consulta}" · Jaén Guía`
      : "Buscar · Jaén Guía",
    // Las páginas de resultados no aportan nada a un buscador y generan
    // URLs infinitas.
    robots: { index: false, follow: true },
  };
}

export default async function BuscarPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const consulta = limpiarConsulta(q);

  // Sin término no se consulta nada: el formulario del hero ya impide
  // enviar vacío, pero se puede llegar aquí escribiendo la URL a mano.
  const [negocios, { favoritoIds }] = await Promise.all([
    consulta ? buscarNegocios(consulta) : Promise.resolve([]),
    getUsuarioYFavoritos(),
  ]);

  const resultados = negocios.map((negocio) => ({
    ...negocio,
    esFavorito: favoritoIds.has(negocio.id),
  }));


  return (
    <>
      <main className="min-h-screen bg-tierra-50 pt-24 pb-24">
        
        <header className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-20">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('/noise.svg')]" />
          <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
            <span className="mb-4 inline-block rounded-full border border-terracota-500/20 bg-terracota-500/10 px-4 py-1.5 text-sm font-bold tracking-[0.2em] uppercase text-terracota-600">
              Buscador
            </span>
            <h1 className="font-display text-5xl md:text-7xl leading-tight tracking-tight text-oliva-900 mb-6">
              {consulta ? <>Resultados para <span className="text-terracota-600">«{consulta}»</span></> : "Encuentra tu próximo plan."}
            </h1>
            {consulta && (
              <p className="mx-auto max-w-2xl text-lg text-oliva-700 font-medium">
                {resultados.length === 0
                  ? "No hemos encontrado ningún lugar que coincida."
                  : `${resultados.length} ${
                      resultados.length === 1 ? "lugar encontrado" : "lugares encontrados"
                    }${resultados.length === MAX_RESULTADOS ? " (mostrando los primeros)" : ""}`}
              </p>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-6 mb-16">
          <div className="mx-auto max-w-2xl">
            <form action="/buscar" method="get" className="relative group">
              <label htmlFor="q" className="sr-only">
                Buscar negocios
              </label>
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                {/* La lupa tachada significa "sin resultados": no puede ser
                    el icono por defecto del campo. */}
                {consulta && resultados.length === 0 ? (
                  <SearchX size={22} aria-hidden="true" className="text-terracota-600" />
                ) : (
                  <Search
                    size={22}
                    aria-hidden="true"
                    className="text-oliva-500 transition-colors group-focus-within:text-terracota-600"
                  />
                )}
              </div>
              <input
                id="q"
                name="q"
                type="search"
                required
                defaultValue={consulta}
                placeholder="¿Qué quieres descubrir?"
                className="w-full rounded-full border border-oliva-100 bg-white py-4 pl-14 pr-32 text-lg text-oliva-900 placeholder:text-oliva-500 outline-none focus:border-terracota-400 focus:ring-4 focus:ring-terracota-500/10 transition-all shadow-sm"
              />
              <div className="absolute inset-y-0 right-2 flex items-center">
                <button
                  type="submit"
                  className="rounded-full bg-oliva-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-terracota-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
                >
                  Buscar
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6">
          {resultados.length === 0 ? (
            <div className="mx-auto max-w-2xl flex flex-col items-center gap-4 rounded-[2rem] border border-oliva-100 bg-white p-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-tierra-50 mb-2">
                <SearchX size={32} aria-hidden="true" className="text-oliva-500" />
              </div>
              <h2 className="text-2xl font-bold text-oliva-900">
                {consulta ? "Sin resultados" : "Empieza a buscar"}
              </h2>
              <p className="text-lg text-oliva-600 max-w-sm mb-4">
                {consulta
                  ? "Prueba con términos más generales o busca por zona o categoría."
                  : "Descubre los mejores rincones de la provincia."}
              </p>
              <Link
                href="/destacados"
                className="rounded-full bg-tierra-50 px-6 py-3 font-bold text-terracota-600 hover:bg-terracota-600 hover:text-white transition-colors"
              >
                Ver lugares destacados
              </Link>
            </div>
          ) : (
            <GridStagger key={consulta} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {resultados.map((negocio) => (
                <NegocioCard
                  key={negocio.slug}
                  negocio={negocio}
                  rutaActual={`/buscar?q=${encodeURIComponent(consulta)}`}
                />
              ))}
            </GridStagger>
          )}
        </div>
      </main>
    </>
  );
}
