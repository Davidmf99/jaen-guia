// negocios.horario es { "lunes": "9:00–22:00", ... }. Los importados de
// Google llevan tilde en las claves ("miércoles", "sábado") y el panel
// las escribe sin tilde (DIAS en /panel/[slug]), así que había dos
// grafías conviviendo: la ficha no encontraba etiqueta para las
// acentuadas y el panel las mostraba vacías (y las perdía al guardar).
// Aquí se normaliza todo a claves sin tilde y en orden lunes→domingo.

export const DIAS_SEMANA = [
  { clave: "lunes", etiqueta: "Lunes" },
  { clave: "martes", etiqueta: "Martes" },
  { clave: "miercoles", etiqueta: "Miércoles" },
  { clave: "jueves", etiqueta: "Jueves" },
  { clave: "viernes", etiqueta: "Viernes" },
  { clave: "sabado", etiqueta: "Sábado" },
  { clave: "domingo", etiqueta: "Domingo" },
] as const;

export type ClaveDia = (typeof DIAS_SEMANA)[number]["clave"];

function sinTildes(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Claves sin tilde; las que no sean un día de la semana se descartan. */
export function normalizarHorario(
  horario: Record<string, string> | null | undefined
): Partial<Record<ClaveDia, string>> {
  const salida: Partial<Record<ClaveDia, string>> = {};
  if (!horario) return salida;
  for (const [clave, valor] of Object.entries(horario)) {
    const limpia = sinTildes(clave) as ClaveDia;
    if (DIAS_SEMANA.some((d) => d.clave === limpia) && valor) salida[limpia] = valor;
  }
  return salida;
}

/** [etiqueta, horas] en orden lunes→domingo, solo los días presentes. */
export function horarioOrdenado(
  horario: Record<string, string> | null | undefined
): Array<{ clave: ClaveDia; etiqueta: string; horas: string }> {
  const h = normalizarHorario(horario);
  return DIAS_SEMANA.flatMap((d) =>
    h[d.clave] ? [{ clave: d.clave, etiqueta: d.etiqueta, horas: h[d.clave]! }] : []
  );
}

// ---------------------------------------------------------------
// "Abierto ahora"
//
// Los valores del horario vienen de Google en castellano:
//   "12:00–24:00" · "12:00–1:00" · "8:00–14:00, 17:00–21:00" ·
//   "Cerrado" · "Abierto 24 horas"
// Se interpreta cada tramo en minutos desde medianoche. Un tramo que
// acaba antes de empezar ("20:00–2:00") cruza la medianoche, así que a
// la 1:30 del sábado hay que mirar también el tramo del viernes.
// ---------------------------------------------------------------

const ZONA_HORARIA = "Europe/Madrid";

interface Tramo {
  inicio: number; // minutos desde 00:00
  fin: number; // puede ser > 1440 si cruza la medianoche
}

function parsearTramos(valor: string): Tramo[] | "todo_el_dia" | null {
  const v = valor.trim().toLowerCase();
  if (!v || v.startsWith("cerrado")) return null;
  if (v.startsWith("abierto 24")) return "todo_el_dia";

  const tramos: Tramo[] = [];
  for (const parte of v.split(",")) {
    const m = parte.match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
    if (!m) continue;
    const inicio = Number(m[1]) * 60 + Number(m[2]);
    let fin = Number(m[3]) * 60 + Number(m[4]);
    if (fin <= inicio) fin += 24 * 60;
    tramos.push({ inicio, fin });
  }
  return tramos.length ? tramos : null;
}

/** Día de la semana (clave sin tilde) y minutos desde medianoche en Jaén. */
function ahoraEnJaen(fecha: Date): { dia: ClaveDia; minutos: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HORARIA,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(fecha);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const DIA_EN: Record<string, ClaveDia> = {
    Mon: "lunes",
    Tue: "martes",
    Wed: "miercoles",
    Thu: "jueves",
    Fri: "viernes",
    Sat: "sabado",
    Sun: "domingo",
  };
  // "24" puede aparecer como hora en algunos motores para medianoche.
  const hora = Number(get("hour")) % 24;
  return { dia: DIA_EN[get("weekday")] ?? "lunes", minutos: hora * 60 + Number(get("minute")) };
}

function diaAnterior(dia: ClaveDia): ClaveDia {
  const i = DIAS_SEMANA.findIndex((d) => d.clave === dia);
  return DIAS_SEMANA[(i + 6) % 7].clave;
}

/**
 * true si el negocio está abierto en `fecha` (por defecto, ahora).
 * null si no hay horario con el que decidirlo.
 */
export function estaAbierto(
  horario: Record<string, string> | null | undefined,
  fecha: Date = new Date()
): boolean | null {
  const h = normalizarHorario(horario);
  if (Object.keys(h).length === 0) return null;

  const { dia, minutos } = ahoraEnJaen(fecha);

  const hoy = parsearTramos(h[dia] ?? "");
  if (hoy === "todo_el_dia") return true;
  if (hoy && hoy.some((t) => minutos >= t.inicio && minutos < t.fin)) return true;

  // Tramo de ayer que cruza la medianoche ("20:00–2:00" y son la 1:30).
  const ayer = parsearTramos(h[diaAnterior(dia)] ?? "");
  if (ayer && ayer !== "todo_el_dia") {
    const m = minutos + 24 * 60;
    if (ayer.some((t) => t.fin > 24 * 60 && m >= t.inicio && m < t.fin)) return true;
  }

  return false;
}

/** "Cierra a las 24:00" / "Abre a las 20:00" para pintar junto al estado. */
export function proximoCambio(
  horario: Record<string, string> | null | undefined,
  fecha: Date = new Date()
): string | null {
  const h = normalizarHorario(horario);
  const { dia, minutos } = ahoraEnJaen(fecha);
  const fmt = (min: number) => {
    const m = min % (24 * 60);
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  };

  const hoy = parsearTramos(h[dia] ?? "");
  if (hoy === "todo_el_dia") return null;
  if (hoy) {
    const actual = hoy.find((t) => minutos >= t.inicio && minutos < t.fin);
    if (actual) return `Cierra a las ${fmt(actual.fin)}`;
  }
  // Antes de anunciar "abre a las…": a la 1:30 del sábado puede seguir
  // vigente el tramo del viernes.
  const ayer = parsearTramos(h[diaAnterior(dia)] ?? "");
  if (ayer && ayer !== "todo_el_dia") {
    const m = minutos + 24 * 60;
    const actual = ayer.find((t) => t.fin > 24 * 60 && m >= t.inicio && m < t.fin);
    if (actual) return `Cierra a las ${fmt(actual.fin)}`;
  }
  if (hoy) {
    const siguiente = hoy.find((t) => t.inicio > minutos);
    if (siguiente) return `Abre a las ${fmt(siguiente.inicio)}`;
  }
  return null;
}

// ---------------------------------------------------------------
// Horario en formato schema.org (OpeningHoursSpecification), para el
// JSON-LD de la ficha. Un tramo que cruza la medianoche se expresa con
// closes < opens, que es lo que Google espera ("20:00" → "02:00").
// "Abierto 24 horas" es 00:00 → 23:59 por convención de Google.
// ---------------------------------------------------------------

const DIA_SCHEMA: Record<ClaveDia, string> = {
  lunes: "Monday",
  martes: "Tuesday",
  miercoles: "Wednesday",
  jueves: "Thursday",
  viernes: "Friday",
  sabado: "Saturday",
  domingo: "Sunday",
};

function hhmm(minutos: number) {
  const m = minutos % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function horarioSchema(horario: Record<string, string> | null | undefined) {
  const h = normalizarHorario(horario);
  const salida: Array<{ "@type": "OpeningHoursSpecification"; dayOfWeek: string; opens: string; closes: string }> = [];
  for (const d of DIAS_SEMANA) {
    const valor = h[d.clave];
    if (!valor) continue;
    const tramos = parsearTramos(valor);
    if (!tramos) continue;
    if (tramos === "todo_el_dia") {
      salida.push({ "@type": "OpeningHoursSpecification", dayOfWeek: DIA_SCHEMA[d.clave], opens: "00:00", closes: "23:59" });
      continue;
    }
    for (const t of tramos) {
      salida.push({ "@type": "OpeningHoursSpecification", dayOfWeek: DIA_SCHEMA[d.clave], opens: hhmm(t.inicio), closes: hhmm(t.fin) });
    }
  }
  return salida;
}
