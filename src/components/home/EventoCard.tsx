"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { MapPin } from "lucide-react";
import { fechaEvento } from "@/lib/eventos";
import ImagenEvento from "./ImagenEvento";
import type { Categoria } from "@/types";

// Mismo escalonado de entrada que NegocioCard (delay creciente con tope,
// ver el comentario largo allí): el contenedor GridStagger lleva las
// tarjetas de "hidden" a "visible" y cada una calcula su propio delay.
const STAGGER_PASO = 0.06;
const STAGGER_CAP = 10;

function delayEntrada(index: number) {
  return Math.min(index, STAGGER_CAP - 1) * STAGGER_PASO;
}

export interface EventoTarjeta {
  id: string;
  slug: string;
  titulo: string;
  fecha_inicio: string;
  es_todo_el_dia: boolean;
  es_gratis: boolean;
  imagen: string | null;
  /** lugar_nombre del evento o, si cuelga de un negocio, el del negocio. */
  lugar: string | null;
  categoriaNombre: string | null;
  categoriaTipo: Categoria["tipo"] | null;
}

interface Props {
  evento: EventoTarjeta;
  /** Posición dentro del grid, para el delay escalonado. */
  index?: number;
}

export default function EventoCard({ evento, index = 0 }: Props) {
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
      className="group overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow"
    >
      {/* Misma relación de aspecto que NegocioCard, para que las
          tarjetas de las dos secciones se lean como una sola retícula. */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <ImagenEvento
          imagen={evento.imagen}
          titulo={evento.titulo}
          fechaInicio={evento.fecha_inicio}
          categoriaTipo={evento.categoriaTipo}
        />

        {evento.categoriaNombre && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-oliva-900">
            {evento.categoriaNombre}
          </span>
        )}

        {evento.es_gratis && (
          <span className="absolute right-3 top-3 rounded-full bg-terracota-500 px-2 py-1 text-xs font-semibold text-white">
            Gratis
          </span>
        )}
      </div>

      <div className="p-4">
        <p className="text-xs font-medium text-terracota-600">
          {fechaEvento(evento.fecha_inicio, evento.es_todo_el_dia)}
        </p>
        <h3 className="mt-1 font-display text-base font-semibold leading-snug text-oliva-900">
          <Link
            href={`/evento/${evento.slug}`}
            className="hover:text-terracota-600 transition-colors"
          >
            {evento.titulo}
          </Link>
        </h3>
        {evento.lugar && (
          <p className="mt-1.5 flex items-center gap-1 text-sm text-oliva-700">
            <MapPin size={13} aria-hidden="true" className="shrink-0 text-oliva-400" />
            <span className="truncate">{evento.lugar}</span>
          </p>
        )}
      </div>
    </motion.article>
  );
}
