"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import GridStagger from "@/components/motion/GridStagger";
import EventoCard, { type EventoTarjeta } from "./EventoCard";

export interface GrupoAgenda {
  clave: "hoy" | "manana" | "finde" | "proximos";
  etiqueta: string;
  eventos: EventoTarjeta[];
  /** Listado completo de ese corte en /eventos. */
  href: string;
}

interface Props {
  grupos: GrupoAgenda[];
}

const VACIO: Record<GrupoAgenda["clave"], string> = {
  hoy: "Hoy no hay nada publicado todavía.",
  manana: "Mañana no hay nada publicado todavía.",
  finde: "Este fin de semana no hay nada publicado todavía.",
  proximos: "Todavía no hay eventos programados en Jaén.",
};

export default function AgendaCortes({ grupos }: Props) {
  // Se abre por el primer corte con algo que enseñar: si hoy no hay nada,
  // la sección no arranca en un hueco vacío.
  const inicial = grupos.find((g) => g.eventos.length > 0) ?? grupos[0];
  const [activa, setActiva] = useState(inicial.clave);

  const grupo = grupos.find((g) => g.clave === activa) ?? inicial;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-3xl font-bold tracking-tight text-oliva-900">
          Qué hacer en Jaén
        </h2>
        {grupo.eventos.length > 0 && (
          <Link
            href={grupo.href}
            className="text-sm font-medium text-terracota-600 hover:underline"
          >
            Ver todos &rsaquo;
          </Link>
        )}
      </div>

      <div role="tablist" aria-label="Cuándo" className="mb-5 flex flex-wrap gap-2">
        {grupos.map((g) => {
          const activo = g.clave === activa;
          return (
            <button
              key={g.clave}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setActiva(g.clave)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                activo
                  ? "bg-oliva-900 text-white"
                  : "border border-oliva-100 bg-white text-oliva-700 hover:bg-oliva-100"
              }`}
            >
              {g.etiqueta}
              {g.eventos.length > 0 && (
                <span className={activo ? "ml-1.5 text-white/70" : "ml-1.5 text-oliva-400"}>
                  {g.eventos.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {grupo.eventos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CalendarDays size={26} aria-hidden="true" className="text-oliva-400" />
          <p className="text-oliva-600">{VACIO[grupo.clave]}</p>
          <Link
            href="/panel"
            className="text-sm font-semibold text-terracota-600 hover:underline"
          >
            ¿Tienes un negocio? Publica lo que pasa en tu local &rsaquo;
          </Link>
        </div>
      ) : (
        // key: al cambiar de corte se remonta la rejilla para que el
        // escalonado de entrada vuelva a correr.
        <GridStagger
          key={grupo.clave}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3"
        >
          {grupo.eventos.map((evento, i) => (
            <EventoCard key={evento.id} evento={evento} index={i} />
          ))}
        </GridStagger>
      )}
    </>
  );
}
