import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calcularPuntuacionMedia } from "@/lib/resenas";
import { getUsuarioYFavoritos } from "@/lib/favoritos";
import NegocioCard from "./NegocioCard";
import EstadoVacio from "./EstadoVacio";
import AnimatedSection from "@/components/motion/AnimatedSection";
import GridStagger from "@/components/motion/GridStagger";

interface NegocioDestacadoRow {
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

async function getDestacados() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("negocios")
    .select(
      "id, nombre, slug, descripcion_corta, imagen_portada, google_photo_name, google_photo_atribucion, categoria:categorias(nombre), resenas(puntuacion)"
    )
    .eq("destacado", true)
    .returns<NegocioDestacadoRow[]>();

  if (error || !data) return [];

  return data
    .map((negocio) => ({
      id: negocio.id,
      nombre: negocio.nombre,
      slug: negocio.slug,
      descripcion_corta: negocio.descripcion_corta,
      imagen_portada: negocio.imagen_portada,
      google_photo_name: negocio.google_photo_name,
      google_photo_atribucion: negocio.google_photo_atribucion,
      categoriaNombre: negocio.categoria?.nombre,
      // Ordenar en memoria (más abajo) solo es correcto aquí porque el
      // filtro `destacado = true` ya reduce el resultado a un conjunto
      // pequeño y curado a mano. Si esta misma lógica se reutiliza para
      // un listado tipo "mejor valorados" sin ese filtro, hay que mover
      // el order() y limit() a la propia consulta SQL (o crear una vista
      // con avg(puntuacion)), no seguir ordenando en memoria.
      puntuacion_media: calcularPuntuacionMedia(negocio.resenas),
    }))
    .sort((a, b) => (b.puntuacion_media ?? 0) - (a.puntuacion_media ?? 0))
    .slice(0, 3);
}

export default async function BentoDestacados() {
  const [destacados, { favoritoIds }] = await Promise.all([
    getDestacados(),
    getUsuarioYFavoritos(),
  ]);
  const conFavorito = destacados.map((negocio) => ({
    ...negocio,
    esFavorito: favoritoIds.has(negocio.id),
  }));
  const [principal, ...resto] = conFavorito;

  return (
    <AnimatedSection className="relative z-10 mx-auto max-w-6xl px-6 py-10">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-oliva-900">
          Destacados en Jaén
        </h2>
        <Link
          href="/destacados"
          className="text-sm font-medium text-terracota-600 hover:underline"
        >
          Más &rsaquo;
        </Link>
      </div>

      {!principal ? (
        <EstadoVacio mensaje="Aún no hay negocios destacados" />
      ) : (
        <GridStagger className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <NegocioCard negocio={principal} rutaActual="/" index={0} />
          </div>
          {resto.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
              {resto.map((negocio, i) => (
                <NegocioCard
                  key={negocio.slug}
                  negocio={negocio}
                  rutaActual="/"
                  index={i + 1}
                />
              ))}
            </div>
          )}
        </GridStagger>
      )}
    </AnimatedSection>
  );
}
