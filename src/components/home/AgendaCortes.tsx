"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, RefreshCw } from "lucide-react";
import EventoCard, { type EventoTarjeta } from "./EventoCard";

export interface GrupoAgenda {
  clave: "hoy" | "manana" | "finde" | "proximos";
  etiqueta: string;
  eventos: EventoTarjeta[];
  /** Cuántos hay en total en ese corte: aquí solo se pintan los primeros. */
  total: number;
  /** Listado completo de ese corte en /eventos. */
  href: string;
}

interface Props {
  grupos: GrupoAgenda[];
  /** "hoy a las 09:12": cuándo entró el último evento leído solo. */
  actualizado: string | null;
}

const VACIO: Record<GrupoAgenda["clave"], string> = {
  hoy: "Hoy no hay ningún plan publicado en Jaén.",
  manana: "Mañana no hay ningún plan publicado en Jaén.",
  finde: "Este fin de semana no hay ningún plan publicado en Jaén.",
  proximos: "Todavía no hay eventos programados en Jaén.",
};

/** Cómo se ofrece un corte desde el hueco vacío de otro. */
const IR_A: Record<GrupoAgenda["clave"], string> = {
  hoy: "hoy",
  manana: "mañana",
  finde: "este fin de semana",
  proximos: "los próximos días",
};

export default function AgendaCortes({ grupos, actualizado }: Props) {
  // Siempre arranca en "Hoy", tenga o no tenga eventos. Antes se abría
  // por el primer corte con algo que enseñar, así que en un día sin nada
  // la pestaña activa saltaba sola a "Próximos" y el usuario veía planes
  // de dentro de dos semanas creyendo que eran de esta tarde. Un hueco
  // vacío explicado informa; un salto silencioso engaña.
  const [activa, setActiva] = useState<GrupoAgenda["clave"]>(grupos[0].clave);

  const grupo = grupos.find((g) => g.clave === activa) ?? grupos[0];

  // Para el hueco vacío: el siguiente corte que sí tenga algo, para
  // ofrecerlo con un botón en vez de dejar al usuario en un callejón.
  const alternativa = grupos.find(
    (g) => g.clave !== grupo.clave && g.eventos.length > 0
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-3xl font-bold tracking-tight text-oliva-900">
          Qué hacer en Jaén
        </h2>
        {grupo.eventos.length > 0 && (
          <Link
            href={grupo.href}
            className="inline-flex min-h-11 items-center text-base font-semibold text-terracota-600 hover:underline"
          >
            Ver todos{grupo.total > grupo.eventos.length ? ` (${grupo.total})` : ""} &rsaquo;
          </Link>
        )}
      </div>

      <div
        role="tablist"
        aria-label="Cuándo"
        className="mb-5 flex flex-wrap gap-2"
      >
        {grupos.map((g) => {
          const activo = g.clave === activa;
          return (
            <button
              key={g.clave}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setActiva(g.clave)}
              className={`flex min-h-11 items-center rounded-full px-4 text-base font-medium transition-colors ${
                activo
                  ? "bg-oliva-900 text-white"
                  : "border border-oliva-100 bg-white text-oliva-700 hover:bg-oliva-100"
              }`}
            >
              {g.etiqueta}
              {/* El contador se pinta también cuando es 0. Escondiéndolo,
                  una pestaña vacía y una llena se veían idénticas y nada
                  avisaba de que hoy no había nada. */}
              <span
                className={`ml-1.5 ${activo ? "text-white/80" : "text-oliva-500"}`}
              >
                {g.total}
              </span>
            </button>
          );
        })}
      </div>

      {grupo.eventos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-oliva-100 bg-white px-6 py-10 text-center">
          <CalendarDays
            size={30}
            aria-hidden="true"
            className="text-oliva-500"
          />
          <p className="text-lg font-semibold text-oliva-900">
            {VACIO[grupo.clave]}
          </p>

          {alternativa && (
            <button
              type="button"
              onClick={() => setActiva(alternativa.clave)}
              className="mt-1 flex min-h-11 items-center rounded-full bg-oliva-900 px-5 text-base font-semibold text-white hover:bg-terracota-700 transition-colors"
            >
              Ver qué hay {IR_A[alternativa.clave]} ({alternativa.total})
            </button>
          )}

          <Link
            href="/para-negocios"
            className="mt-1 text-base font-semibold text-terracota-600 hover:underline"
          >
            ¿Tienes un negocio? Publica lo que pasa en tu local &rsaquo;
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {grupo.eventos.map((evento) => (
            <EventoCard key={evento.id} evento={evento} />
          ))}
        </div>
      )}

      {/* Lo mismo que en /eventos: la agenda se llena sola cada mañana y
          hay que decirlo, sobre todo los días flojos. */}
      <p className="mt-5 flex flex-wrap items-center gap-x-1.5 text-sm text-oliva-600">
        <RefreshCw size={14} aria-hidden="true" className="shrink-0" />
        <span>
          Se actualiza cada mañana con lo que publican los propios sitios
          {actualizado && <> · última actualización {actualizado}</>}. Vuelve mañana: habrá más.
        </span>
      </p>
    </>
  );
}
