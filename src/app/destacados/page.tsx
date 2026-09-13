import type { Metadata } from "next";
import NegocioCard from "@/components/home/NegocioCard";
import EstadoVacio from "@/components/home/EstadoVacio";
import { createClient } from "@/lib/supabase/server";
import { calcularPuntuacionMedia } from "@/lib/resenas";
import { getUsuarioYFavoritos } from "@/lib/favoritos";
import GridStagger from "@/components/motion/GridStagger";

const TITULO = "Destacados en Jaén";
const DESCRIPCION = "Una selección de los mejores sitios de la ciudad, elegidos a mano.";

export const metadata: Metadata = {
  title: `${TITULO} · Jaén Guía`,
  description: DESCRIPCION,
};

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
    destacado: true,
    puntuacion_media: calcularPuntuacionMedia(negocio.resenas),
  };
}

// A diferencia de [categoria]/page.tsx, aquí no se filtra por
// categoria.tipo (destacados cruza las 5) y no hace falta paginar: es
// una selección pequeña (editorial a mano o plan Destacado pagado,
// `es_destacado`, migración 0017), no un listado grande.
async function getDestacados() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("negocios")
    .select(
      "id, nombre, slug, descripcion_corta, imagen_portada, google_photo_name, google_photo_atribucion, categoria:categorias(nombre), resenas(puntuacion)"
    )
    .eq("es_destacado", true)
    .order("nombre", { ascending: true })
    .returns<NegocioRow[]>();

  if (error || !data) return [];
  return data.map(aTarjeta);
}

export default async function DestacadosPage() {
  const [negocios, { favoritoIds }] = await Promise.all([
    getDestacados(),
    getUsuarioYFavoritos(),
  ]);
  const negociosConFavorito = negocios.map((negocio) => ({
    ...negocio,
    esFavorito: favoritoIds.has(negocio.id),
  }));

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 max-w-2xl">
          <h1 className="font-display text-3xl font-semibold text-oliva-900">
            {TITULO}
          </h1>
          <p className="mt-2 text-oliva-700">{DESCRIPCION}</p>
        </header>

        {negociosConFavorito.length === 0 ? (
          <EstadoVacio mensaje="Aún no hay negocios destacados" />
        ) : (
          <GridStagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {negociosConFavorito.map((negocio) => (
              <NegocioCard
                key={negocio.slug}
                negocio={negocio}
                rutaActual="/destacados"
              />
            ))}
          </GridStagger>
        )}
      </main>
    </>
  );
}
