import Link from "next/link";
import { Star } from "lucide-react";
import type { Negocio } from "@/types";
import BotonFavorito from "@/components/BotonFavorito";
import ImagenNegocio from "@/components/ImagenNegocio";

interface Props {
  negocio: Pick<
    Negocio,
    | "id"
    | "slug"
    | "nombre"
    | "descripcion_corta"
    | "imagen_portada"
    | "google_photo_name"
    | "google_photo_atribucion"
    | "puntuacion_media"
  > & {
    categoriaNombre?: string;
    esFavorito?: boolean;
    /** Calculado en el servidor con estaAbierto(); null si no hay horario. */
    abiertoAhora?: boolean | null;
    /** negocios.es_destacado: insignia y borde para que se note en el listado. */
    destacado?: boolean;
  };
  rutaActual: string;
}

// Relación de aspecto fija para la imagen, igual en todas las tarjetas.
// Antes la altura salía de un prop `size` (h-56 para la destacada, h-40
// para el resto) y en el bento de la home las tres tarjetas tienen el
// mismo ancho pero distinta altura de imagen, así que los títulos no
// alineaban. Con una proporción constante y object-cover (lo aplica
// ImagenNegocio) todas las tarjetas miden lo mismo.
//
// 16/10 ≈ la altura que ya tenía la tarjeta destacada, así que la que
// cambia de tamaño es la mediana, que crece hasta igualarla.
const ASPECTO_IMAGEN = "aspect-[16/10]";

// Componente de servidor desde que se retiró el escalonado de entrada.
// Antes era cliente y salía del servidor con style="opacity:0", a la
// espera de que un GridStagger lo pasara a "visible": si el JavaScript
// no llegaba a ejecutarse, los listados se veían vacíos.
export default function NegocioCard({ negocio, rutaActual }: Props) {
  return (
    <article
      className={`group relative overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow ${
        negocio.destacado ? "ring-2 ring-terracota-500/60" : ""
      }`}
    >
      <div className={`relative ${ASPECTO_IMAGEN} overflow-hidden`}>
        <ImagenNegocio
          negocioId={negocio.id}
          nombre={negocio.nombre}
          imagenPortada={negocio.imagen_portada}
          googlePhotoName={negocio.google_photo_name}
          googlePhotoAtribucion={negocio.google_photo_atribucion}
        />
        {/* Una sola fila flex para la etiqueta y el botón: con dos absolutos
            independientes la etiqueta no sabe cuánto ocupa "Guardar" /
            "Guardado" y se le montaba encima cuando llevaba puntuación. Aquí
            el botón no encoge y la etiqueta recorta el nombre de categoría
            (nunca la nota) con el espacio que queda. */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-sm font-medium text-oliva-900">
            {negocio.destacado && (
              <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap font-semibold text-terracota-600">
                <Star size={14} aria-hidden="true" className="fill-terracota-500 text-terracota-500" />
                Destacado
                {negocio.categoriaNombre && <span className="mx-0.5 text-oliva-300" aria-hidden="true">·</span>}
              </span>
            )}
            {negocio.categoriaNombre && (
              <span className="min-w-0 truncate">{negocio.categoriaNombre}</span>
            )}
            {negocio.puntuacion_media && (
              <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-terracota-600">
                <Star
                  size={14}
                  aria-hidden="true"
                  className="fill-terracota-500 text-terracota-500"
                />
                {negocio.puntuacion_media.toFixed(1)}
              </span>
            )}
          </div>
          <div className="pointer-events-auto shrink-0">
            <BotonFavorito
              negocioId={negocio.id}
              esFavorito={negocio.esFavorito ?? false}
              rutaActual={rutaActual}
            />
          </div>
        </div>
      </div>

      <div className="p-4">
        {negocio.abiertoAhora !== undefined && negocio.abiertoAhora !== null && (
          <p
            className={`mb-1.5 flex items-center gap-1.5 text-sm font-semibold ${
              negocio.abiertoAhora ? "text-oliva-700" : "text-oliva-500"
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${negocio.abiertoAhora ? "bg-green-600" : "bg-oliva-200"}`}
            />
            {negocio.abiertoAhora ? "Abierto ahora" : "Cerrado ahora"}
          </p>
        )}
        <h3 className="font-sans text-lg font-bold tracking-tight text-oliva-900">
          <Link
            href={`/negocio/${negocio.slug}`}
            className="hover:text-terracota-600 transition-colors after:absolute after:inset-0"
          >
            {negocio.nombre}
          </Link>
        </h3>
        {negocio.descripcion_corta && (
          <p className="mt-1 text-base text-oliva-700 line-clamp-2">
            {negocio.descripcion_corta}
          </p>
        )}
      </div>
    </article>
  );
}
