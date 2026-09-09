import type { Categoria } from "@/types";

// Las fechas se guardan en timestamptz y se formatean SIEMPRE en la zona
// de Jaén, no en la del servidor ni en la del navegador: si no, un
// evento de las 20:00 se pintaría a una hora distinta según dónde se
// renderice. Es la misma zona que usa dia_local() en la migración 0006
// para calcular la huella de deduplicación.
const ZONA = "Europe/Madrid";

const FORMATO = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type Partes = Record<"day" | "month" | "year" | "hour" | "minute", string>;

function partes(iso: string): Partes {
  return Object.fromEntries(
    FORMATO.formatToParts(new Date(iso)).map((p) => [p.type, p.value])
  ) as Partes;
}

/**
 * "18 de sept. 2026 · 20:00", o sin hora si el evento es de día completo
 * (ferias, exposiciones), donde la hora de inicio no significa nada.
 */
export function fechaEvento(iso: string, esTodoElDia: boolean) {
  const { day, month, year, hour, minute } = partes(iso);
  const fecha = `${day} de ${month}. ${year}`;
  return esTodoElDia ? fecha : `${fecha} · ${hour}:${minute}`;
}

/** Día y mes sueltos, para el hueco de imagen de los eventos sin foto. */
export function diaYMes(iso: string) {
  const { day, month } = partes(iso);
  return { dia: day, mes: month.replace(".", "").toUpperCase() };
}

// Tinte del hueco de imagen cuando el evento no tiene foto. Va por
// categorias.tipo y no por categorias.slug a propósito: `tipo` es un
// CHECK fijo en la base de datos, mientras que los slugs son datos
// editables desde el panel y podrían dejar de coincidir con estas
// claves sin que nadie se entere.
const TINTE: Record<Categoria["tipo"], string> = {
  comer_beber: "from-terracota-400 to-terracota-600",
  cultura: "from-oliva-600 to-oliva-900",
  naturaleza: "from-oliva-400 to-oliva-700",
  tienda: "from-terracota-500 to-oliva-700",
  ocio: "from-oliva-700 to-terracota-500",
};

const TINTE_POR_DEFECTO = "from-oliva-600 to-oliva-900";

export function tintePara(tipo: Categoria["tipo"] | null | undefined) {
  return (tipo && TINTE[tipo]) || TINTE_POR_DEFECTO;
}
