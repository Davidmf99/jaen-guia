/**
 * Un evento tal y como sale de una agenda externa, antes de tocar la
 * base de datos. Deliberadamente pobre: título, cuándo, dónde y enlace.
 *
 * No se importan descripciones ni carteles de terceros. Los datos de un
 * hecho (qué, cuándo, dónde) no son obra protegida; el texto redactado y
 * las fotos de la agenda de origen sí, y no tenemos licencia sobre ellos.
 * Cada evento importado enlaza siempre a su ficha original.
 */
export interface EventoImportado {
  titulo: string;
  /** ISO 8601 en UTC. */
  fechaInicio: string;
  /** ISO 8601 en UTC, si la fuente da un rango. */
  fechaFin?: string | null;
  /** La fuente no publica hora, solo día. */
  esTodoElDia: boolean;
  lugarNombre?: string | null;
  /** Nombre del municipio tal y como lo escribe la fuente. */
  municipioNombre?: string | null;
  /** Enlace a la ficha original. Es también la clave de actualización. */
  url: string;
}

export interface Fuente {
  /** Va a `eventos.fuente_nombre`. */
  nombre: string;
  /** Identificador corto para los logs. */
  clave: string;
  obtener(): Promise<EventoImportado[]>;
}

const MESES: Record<string, number> = {
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
};

export function numeroDeMes(nombre: string): number | null {
  const clave = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .trim();
  return MESES[clave] ?? null;
}

/**
 * Construye un ISO UTC a partir de una fecha y hora en Jaén.
 *
 * Se calcula el desfase real (+01:00 / +02:00) para ese día concreto en
 * vez de fijarlo: si no, medio año entraría con una hora de más.
 */
export function isoEnJaen(
  anio: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0
): string | null {
  const dd = String(dia).padStart(2, "0");
  const mm = String(mes).padStart(2, "0");
  const hh = String(hora).padStart(2, "0");
  const mi = String(minuto).padStart(2, "0");

  const aproximado = new Date(`${anio}-${mm}-${dd}T${hh}:${mi}:00Z`);
  if (Number.isNaN(aproximado.getTime())) return null;

  const nombreZona = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    timeZoneName: "longOffset",
  })
    .formatToParts(aproximado)
    .find((p) => p.type === "timeZoneName")?.value;

  const desfase = (nombreZona ?? "GMT+00:00").replace("GMT", "") || "+00:00";
  const fecha = new Date(`${anio}-${mm}-${dd}T${hh}:${mi}:00${desfase}`);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

/** Colapsa espacios y decodifica las entidades HTML más comunes. */
export function limpiarTexto(texto: string): string {
  return texto
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Slug para un evento importado.
 *
 * Lo normal es dejar que lo rellene el trigger `eventos_slug` (migración
 * 0006), pero en la base de datos remota ese trigger genera slugs con
 * puntuación —"concierto:-obk-...", "monologos:-eva-y-que-|-..."— y esas
 * URLs no resuelven: la ficha del evento devolvía 404. Enviando el slug
 * ya hecho, el trigger no toca nada (solo actúa si viene vacío) y deja
 * de importar en qué estado esté la función remota.
 *
 * El sufijo sale de la url de origen, no de un aleatorio: así el slug es
 * el mismo en cada sincronización y los enlaces compartidos no se rompen.
 */
export function slugImportado(titulo: string, url: string, sufijo: string) {
  const base = titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return `${base || "evento"}-${sufijo}`;
}
