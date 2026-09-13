import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calcularPuntuacionMedia } from "@/lib/resenas";
import { getUsuarioYFavoritos } from "@/lib/favoritos";
import NegocioCard from "./NegocioCard";
import EstadoVacio from "./EstadoVacio";
import AnimatedSection from "@/components/motion/AnimatedSection";
import GridStagger from "@/components/motion/GridStagger";
import { PRECIO_PLAN_DESTACADO } from "@/lib/stripe";

interface NegocioDestacadoRow {
  id: string;
  nombre: string;
  slug: string;
  descripcion_corta: string | null;
  imagen_portada: string | null;
  google_photo_name: string | null;
  google_photo_atribucion: string | null;
  categoria: { nombre: string } | null;
  plan: string;
  resenas: { puntuacion: number }[];
}

const HUECOS = 3;

// Los que pagan el plan Destacado van primero; si hay más de HUECOS,
// rotan por días para que todos salgan en portada. Detrás, la selección
// editorial por valoración.
function ordenarParaPortada<T extends { plan: string; puntuacion_media: number | null | undefined }>(lista: T[]): T[] {
  const porValoracion = (a: T, b: T) => (b.puntuacion_media ?? 0) - (a.puntuacion_media ?? 0);
  const pagados = lista.filter((n) => n.plan === "destacado").sort(porValoracion);
  const editoriales = lista.filter((n) => n.plan !== "destacado").sort(porValoracion);

  if (pagados.length > HUECOS) {
    const dia = Math.floor(Date.now() / 86_400_000);
    const desde = dia % pagados.length;
    return [...pagados.slice(desde), ...pagados.slice(0, desde)].slice(0, HUECOS);
  }
  return [...pagados, ...editoriales].slice(0, HUECOS);
}

async function getDestacados() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("negocios")
    .select(
      "id, nombre, slug, descripcion_corta, imagen_portada, google_photo_name, google_photo_atribucion, plan, categoria:categorias(nombre), resenas(puntuacion)"
    )
    .eq("es_destacado", true)
    .returns<NegocioDestacadoRow[]>();

  if (error || !data) return [];

  return ordenarParaPortada(
    data.map((negocio) => ({
      id: negocio.id,
      plan: negocio.plan,
      nombre: negocio.nombre,
      slug: negocio.slug,
      descripcion_corta: negocio.descripcion_corta,
      imagen_portada: negocio.imagen_portada,
      google_photo_name: negocio.google_photo_name,
      google_photo_atribucion: negocio.google_photo_atribucion,
      categoriaNombre: negocio.categoria?.nombre,
      // Ordenar en memoria (ordenarParaPortada) solo es correcto aquí
      // porque el filtro `es_destacado = true` ya reduce el resultado a
      // un conjunto pequeño. Para un listado grande tipo "mejor
      // valorados" habría que ordenar y limitar en SQL.
      puntuacion_media: calcularPuntuacionMedia(negocio.resenas),
    }))
  );
}

export default async function BentoDestacados() {
  const [destacados, { favoritoIds }] = await Promise.all([
    getDestacados(),
    getUsuarioYFavoritos(),
  ]);
  const conFavorito = destacados.map((negocio) => ({
    ...negocio,
    esFavorito: favoritoIds.has(negocio.id),
    destacado: true,
  }));
  const [principal, ...resto] = conFavorito;

  return (
    <AnimatedSection className="mx-auto max-w-6xl px-6 py-24">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-3xl font-bold tracking-tight text-oliva-900">
          Destacados en Jaén
        </h2>
        <Link
          href="/destacados"
          className="inline-flex min-h-11 items-center text-base font-semibold text-terracota-600 hover:underline"
        >
          Ver todos los destacados &rsaquo;
        </Link>
      </div>

      {!principal ? (
        <EstadoVacio mensaje="Aún no hay negocios destacados" />
      ) : (
        <GridStagger className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <NegocioCard negocio={principal} rutaActual="/" />
          </div>
          {resto.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2">
              {resto.map((negocio) => (
                <NegocioCard
                  key={negocio.slug}
                  negocio={negocio}
                  rutaActual="/"
                />
              ))}
            </div>
          )}
        </GridStagger>
      )}

      {/* Hueco de venta: es el sitio donde un dueño ve lo que compra. */}
      <p className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-terracota-500/40 bg-white px-5 py-4 text-base text-oliva-700">
        <span>
          <span className="font-semibold text-oliva-900">¿Quieres destacar tu negocio?</span> Sale aquí, en la
          portada, y arriba en su categoría. Desde {PRECIO_PLAN_DESTACADO}.
        </span>
        <Link
          href="/para-negocios#destacado"
          className="inline-flex min-h-11 items-center gap-1 rounded-full bg-terracota-500 px-5 font-semibold text-white hover:bg-terracota-600 transition-colors"
        >
          Añade el tuyo &rsaquo;
        </Link>
      </p>
    </AnimatedSection>
  );
}
