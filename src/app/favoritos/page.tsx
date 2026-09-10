import type { Metadata } from "next";
import { redirect } from "next/navigation";
import NegocioCard from "@/components/home/NegocioCard";
import EstadoVacio from "@/components/home/EstadoVacio";
import { createClient } from "@/lib/supabase/server";
import { calcularPuntuacionMedia } from "@/lib/resenas";
import GridStagger from "@/components/motion/GridStagger";

export const metadata: Metadata = {
  title: "Mis favoritos · Jaén Guía",
  description: "Los negocios que has guardado en Jaén Guía.",
};

interface FavoritoRow {
  negocio: {
    id: string;
    nombre: string;
    slug: string;
    descripcion_corta: string | null;
    imagen_portada: string | null;
    google_photo_name: string | null;
    google_photo_atribucion: string | null;
    categoria: { nombre: string } | null;
    resenas: { puntuacion: number }[];
  } | null;
}

export default async function FavoritosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("favoritos")
    .select(
      "negocio:negocios(id, nombre, slug, descripcion_corta, imagen_portada, google_photo_name, google_photo_atribucion, categoria:categorias(nombre), resenas(puntuacion))"
    )
    .eq("usuario_id", user.id)
    .returns<FavoritoRow[]>();

  // El embed de negocios puede venir null si el negocio ya no cumple su
  // propia política de RLS (activo = true), aunque la fila de favoritos
  // siga existiendo.
  const negocios = (error || !data ? [] : data)
    .map((fila) => fila.negocio)
    .filter((n): n is NonNullable<FavoritoRow["negocio"]> => n !== null)
    .map((negocio) => ({
      id: negocio.id,
      slug: negocio.slug,
      nombre: negocio.nombre,
      descripcion_corta: negocio.descripcion_corta,
      imagen_portada: negocio.imagen_portada,
      google_photo_name: negocio.google_photo_name,
      google_photo_atribucion: negocio.google_photo_atribucion,
      categoriaNombre: negocio.categoria?.nombre,
      puntuacion_media: calcularPuntuacionMedia(negocio.resenas),
      esFavorito: true,
    }));

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-oliva-900">
            Mis favoritos
          </h1>
          <p className="mt-2 text-oliva-700">
            Los negocios que has guardado para volver a ellos.
          </p>
        </header>

        {negocios.length === 0 ? (
          <EstadoVacio mensaje="Aún no has guardado ningún negocio. Explora el directorio y pulsa el corazón en los que más te gusten." />
        ) : (
          <GridStagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {negocios.map((negocio, i) => (
              <NegocioCard
                key={negocio.slug}
                negocio={negocio}
                rutaActual="/favoritos"
                index={i}
              />
            ))}
          </GridStagger>
        )}
      </main>
    </>
  );
}
