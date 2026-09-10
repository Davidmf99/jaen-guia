"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { Star } from "lucide-react";
import type { Negocio } from "@/types";
import BotonFavorito from "@/components/BotonFavorito";
import ImagenNegocio from "@/components/ImagenNegocio";

// Estado de entrada de la propia tarjeta: espera a que un ancestro
// GridStagger la lleve de "hidden" a "visible". Fuera de un
// GridStagger, al no recibir nunca el estado "visible", se queda
// estática — por eso todo listado de NegocioCard debe envolver su grid
// en GridStagger.
//
// El escalonado (delay creciente entre tarjeta y tarjeta) se calcula
// aquí a partir de `index`, con tope: a partir de STAGGER_CAP todas
// comparten el mismo delay fijo (el de la última con delay creciente),
// en vez de seguir sumando — así un listado grande como /gastronomia
// (20+ negocios) no deja las últimas tarjetas esperando varios
// segundos.
const STAGGER_PASO = 0.06;
const STAGGER_CAP = 10;

function delayEntrada(index: number) {
  return Math.min(index, STAGGER_CAP - 1) * STAGGER_PASO;
}

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
  > & { categoriaNombre?: string; esFavorito?: boolean };
  rutaActual: string;
  /** Posición dentro de su grid, para el delay escalonado (ver arriba). */
  index?: number;
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

export default function NegocioCard({ negocio, rutaActual, index = 0 }: Props) {
  const reducirMovimiento = useReducedMotion();

  const delay = reducirMovimiento ? 0 : delayEntrada(index);
  const variantes: Variants = reducirMovimiento
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.3, ease: "easeOut", delay } } }
    : { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut", delay } } };

  return (
    <motion.article
      variants={variantes}
      whileHover={reducirMovimiento ? undefined : { y: -2 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      <div className={`relative ${ASPECTO_IMAGEN} overflow-hidden`}>
        <ImagenNegocio
          negocioId={negocio.id}
          nombre={negocio.nombre}
          imagenPortada={negocio.imagen_portada}
          googlePhotoName={negocio.google_photo_name}
          googlePhotoAtribucion={negocio.google_photo_atribucion}
        />
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-oliva-900">
          {negocio.categoriaNombre && <span>{negocio.categoriaNombre}</span>}
          {negocio.puntuacion_media && (
            <span className="flex items-center gap-0.5 text-terracota-600">
              <Star size={12} aria-hidden="true" className="fill-terracota-500 text-terracota-500" />
              {negocio.puntuacion_media.toFixed(1)}
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3 z-10">
          <BotonFavorito
            negocioId={negocio.id}
            esFavorito={negocio.esFavorito ?? false}
            rutaActual={rutaActual}
          />
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-sans text-lg font-bold tracking-tight text-oliva-900">
          <Link
            href={`/negocio/${negocio.slug}`}
            className="hover:text-terracota-600 transition-colors after:absolute after:inset-0"
          >
            {negocio.nombre}
          </Link>
        </h3>
        {negocio.descripcion_corta && (
          <p className="mt-1 text-sm text-oliva-700 line-clamp-2">
            {negocio.descripcion_corta}
          </p>
        )}
      </div>
    </motion.article>
  );
}
