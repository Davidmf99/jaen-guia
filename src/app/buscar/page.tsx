import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import Header from "@/components/layout/Header";
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
function limpiarConsulta(bruta: string | undefined) {
  if (!bruta) return "";
  return bruta.trim().slice(0, MAX_LONGITUD_CONSULTA).replace(/[%_]/g, "");
}

async function buscarNegocios(consulta: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("negocios")
    .select(
      "id, nombre, slug, descripcion_corta, imagen_portada, google_photo_name, google_photo_atribucion, categoria:categorias(nombre), resenas(puntuacion)"
    )
    .ilike("nombre", `%${consulta}%`)
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
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 max-w-2xl">
          <h1 className="font-display text-3xl font-semibold text-oliva-900">
            {consulta ? <>Resultados para &laquo;{consulta}&raquo;</> : "Buscar"}
          </h1>
          {consulta && (
            <p className="mt-2 text-oliva-700">
              {resultados.length === 0
                ? "Ningún negocio coincide con esa búsqueda."
                : `${resultados.length} ${
                    resultados.length === 1 ? "negocio" : "negocios"
                  }${resultados.length === MAX_RESULTADOS ? " (primeros resultados)" : ""}`}
            </p>
          )}
        </header>

        {/* Buscar de nuevo sin tener que volver a la home. */}
        <form action="/buscar" method="get" className="mb-8 flex max-w-md gap-2">
          <label htmlFor="q" className="sr-only">
            Buscar negocios
          </label>
          <input
            id="q"
            name="q"
            type="search"
            required
            defaultValue={consulta}
            placeholder="¿Qué quieres descubrir?"
            className="flex-1 rounded-full border border-oliva-100 px-4 py-2 text-sm outline-none focus:border-oliva-400"
          />
          <button
            type="submit"
            className="rounded-full bg-terracota-500 px-5 py-2 text-sm font-semibold text-white hover:bg-terracota-600 transition-colors"
          >
            Buscar
          </button>
        </form>

        {resultados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-oliva-100 bg-tierra-50 px-6 py-12 text-center">
            <SearchX size={28} aria-hidden="true" className="text-oliva-400" />
            <p className="font-display text-base text-oliva-700">
              {consulta
                ? "No hemos encontrado ningún negocio con ese nombre"
                : "Escribe algo para empezar a buscar"}
            </p>
            <Link
              href="/destacados"
              className="text-sm font-semibold text-terracota-600 hover:underline"
            >
              Ver los destacados de Jaén &rsaquo;
            </Link>
          </div>
        ) : (
          <GridStagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {resultados.map((negocio, i) => (
              <NegocioCard
                key={negocio.slug}
                negocio={negocio}
                rutaActual={`/buscar?q=${encodeURIComponent(consulta)}`}
                index={i}
              />
            ))}
          </GridStagger>
        )}
      </main>
    </>
  );
}
