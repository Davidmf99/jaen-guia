"use client";

import { useState } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { MapPin } from "lucide-react";
import { diaYMes, fechaEvento, tintePara } from "@/lib/eventos";
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
  const [falloImagen, setFalloImagen] = useState(false);

  // El hueco de imagen nunca queda vacío: si el evento no tiene foto, o
  // si la que tiene no carga en el navegador, se pinta el día y el mes
  // en grande sobre el tinte de su categoría.
  const hayImagen = Boolean(evento.imagen) && !falloImagen;
  const { dia, mes } = diaYMes(evento.fecha_inicio);

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
        {hayImagen ? (
          /* eslint-disable-next-line @next/next/no-img-element -- URL externa de la agenda/negocio, sin dominios fijos que declarar en next.config */
          <img
            src={evento.imagen!}
            alt={evento.titulo}
            onError={() => setFalloImagen(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${tintePara(
              evento.categoriaTipo
            )} text-white`}
          >
            <span className="font-display text-5xl font-semibold leading-none">
              {dia}
            </span>
            <span className="mt-1.5 text-xs font-semibold tracking-[0.2em] text-white/80">
              {mes}
            </span>
          </div>
        )}

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
          {evento.titulo}
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
