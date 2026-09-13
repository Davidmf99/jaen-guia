import type { Categoria } from "@/types";

// Las fechas se guardan en timestamptz y se formatean SIEMPRE en la zona
// de Jaén, no en la del servidor ni en la del navegador: si no, un
// evento de las 20:00 se pintaría a una hora distinta según dónde se
// renderice. Es la misma zona que usa dia_local() en la migración 0006
// para calcular la huella de deduplicación.
const ZONA = "Europe/Madrid";

// Mes y día de la semana completos, y sin año en el formato base: el año
// se añade solo cuando no es el que corre (ver `anioSiSobra`). Abreviar a
// "18 de sept. 2026 · 20:00" ahorraba tres caracteres a cambio de que la
// fecha se lea peor, que es justo lo contrario de lo que necesita quien
// entra a mirar si esta tarde hay algo.
const FORMATO = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type Partes = Record<
  "weekday" | "day" | "month" | "year" | "hour" | "minute",
  string
>;

function partes(iso: string): Partes {
  return Object.fromEntries(
    FORMATO.formatToParts(new Date(iso)).map((p) => [p.type, p.value])
  ) as Partes;
}

function mayuscula(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Día siguiente a una fecha "YYYY-MM-DD", en hora de Jaén.
 *
 * Se suman 24 h sobre el mediodía UTC de ese día y no sobre el instante
 * real: a mediodía sobran doce horas de margen por cada lado, así que el
 * cambio de hora de marzo (donde sumar 24 h a las 23:30 se salta un día
 * entero) no puede desplazar el resultado.
 */
function diaSiguiente(diaISO: string) {
  const mediodia = new Date(`${diaISO}T12:00:00Z`);
  return diaMadrid(new Date(mediodia.getTime() + 86_400_000));
}

/** El año solo se dice cuando no es el que corre; si no, es ruido. */
function anioSiSobra(iso: string, ahora: Date) {
  const anio = partes(iso).year;
  return anio === partes(ahora.toISOString()).year ? "" : ` de ${anio}`;
}

/**
 * Fecha de un evento tal y como la diría alguien de viva voz:
 * "Hoy a las 20:00", "Mañana a las 20:00", "Sábado 18 de octubre a las
 * 20:00". Sin hora si el evento es de día completo (ferias,
 * exposiciones), donde la hora de inicio no significa nada.
 *
 * `ahora` es parámetro y no `new Date()` a secas para que se pueda
 * probar, y porque quien llama a esto está siempre en el servidor: la
 * cadena ya formateada es la que viaja a las tarjetas, que son cliente.
 * Calcular el "hoy" en el navegador descuadraría el HTML del servidor.
 */
export function fechaEvento(
  iso: string,
  esTodoElDia: boolean,
  ahora = new Date()
) {
  return formatearFecha(iso, esTodoElDia, ahora, true);
}

/**
 * Igual, pero sin "Hoy" ni "Mañana": siempre la fecha absoluta.
 *
 * Es lo que tiene que ir en el openGraph de la ficha. WhatsApp, Telegram
 * y las redes cachean la tarjeta del enlace la primera vez que alguien lo
 * comparte, así que un "Hoy a las 20:00" se quedaría diciendo "Hoy"
 * durante semanas.
 */
export function fechaEventoAbsoluta(iso: string, esTodoElDia: boolean) {
  return formatearFecha(iso, esTodoElDia, new Date(), false);
}

function formatearFecha(
  iso: string,
  esTodoElDia: boolean,
  ahora: Date,
  permitirRelativo: boolean
) {
  const p = partes(iso);
  const relativo = permitirRelativo ? diaRelativo(iso, ahora) : null;
  const fecha =
    relativo ??
    `${mayuscula(p.weekday)} ${p.day} de ${p.month}${anioSiSobra(iso, ahora)}`;

  return esTodoElDia ? fecha : `${fecha} a las ${p.hour}:${p.minute}`;
}

/** "Hoy" / "Mañana", o null si la fecha cae más lejos. */
function diaRelativo(iso: string, ahora: Date): string | null {
  const hoy = diaMadrid(ahora);
  const cuando = diaMadrid(new Date(iso));

  if (cuando === hoy) return "Hoy";
  if (cuando === diaSiguiente(hoy)) return "Mañana";
  return null;
}

/**
 * Etiqueta de fecha para una tarjeta, teniendo en cuenta los rangos.
 *
 * Una feria del 5 de julio al 25 de octubre sigue vigente hoy, y poner
 * "05 de jul." en la pestaña de "Hoy" despista: lo que importa es hasta
 * cuándo se puede ir. Se calcula en el servidor y se pasa ya formateada
 * a la tarjeta, que es un Client Component: si el "ahora" se calculara
 * en el cliente, el HTML del servidor y el del navegador no coincidirían.
 */
export function etiquetaFecha(
  fechaInicio: string,
  fechaFin: string | null,
  esTodoElDia: boolean,
  ahora = new Date()
): string {
  if (!fechaFin) return fechaEvento(fechaInicio, esTodoElDia, ahora);

  if (diaMadrid(new Date(fechaInicio)) === diaMadrid(new Date(fechaFin))) {
    return fechaEvento(fechaInicio, esTodoElDia, ahora);
  }

  if (new Date(fechaInicio) <= ahora) {
    // Que hoy sea el último día es la información más accionable que
    // puede dar una tarjeta, así que se dice en esos términos.
    const relativo = diaRelativo(fechaFin, ahora);
    if (relativo === "Hoy") return "Hoy es el último día";
    if (relativo === "Mañana") return "Hasta mañana";
    return `Hasta el ${soloFecha(fechaFin, ahora)}`;
  }

  // Dentro del mismo mes no hace falta repetirlo: "Del 5 al 25 de octubre".
  const inicio = partes(fechaInicio);
  const fin = partes(fechaFin);
  if (inicio.month === fin.month && inicio.year === fin.year) {
    return `Del ${inicio.day} al ${soloFecha(fechaFin, ahora)}`;
  }

  return `Del ${soloFecha(fechaInicio, ahora)} al ${soloFecha(fechaFin, ahora)}`;
}

function soloFecha(iso: string, ahora: Date) {
  const { day, month } = partes(iso);
  return `${day} de ${month}${anioSiSobra(iso, ahora)}`;
}

// El hueco de imagen quiere el mes en tres letras y en mayúsculas
// ("SEPT"), que no es lo que da FORMATO desde que este pinta el mes
// completo. De ahí un formateador aparte solo para eso.
const FORMATO_CORTO = new Intl.DateTimeFormat("es-ES", {
  timeZone: ZONA,
  day: "2-digit",
  month: "short",
});

/** Día y mes sueltos, para el hueco de imagen de los eventos sin foto. */
export function diaYMes(iso: string) {
  const p = Object.fromEntries(
    FORMATO_CORTO.formatToParts(new Date(iso)).map((x) => [x.type, x.value])
  ) as Record<"day" | "month", string>;
  return { dia: p.day, mes: p.month.replace(".", "").toUpperCase() };
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

/**
 * Filtro de "eventos todavía vigentes" para PostgREST, equivalente a
 * `coalesce(fecha_fin, fecha_inicio) >= now()`.
 *
 * Filtrar solo por fecha_inicio hacía desaparecer un evento de varios
 * días en cuanto empezaba: una feria del 31 de octubre al 1 de
 * noviembre se caía del listado el mismo día 31. PostgREST no admite
 * coalesce() en un filtro, así que se expresa como: o tiene fecha_fin y
 * aún no ha pasado, o no tiene fecha_fin y su inicio es futuro.
 *
 * Se usa como `.or(filtroEventosVigentes())`.
 */
export function filtroEventosVigentes() {
  const ahora = new Date().toISOString();
  return `fecha_fin.gte.${ahora},and(fecha_fin.is.null,fecha_inicio.gte.${ahora})`;
}

// ---------------------------------------------------------------------
// Cortes temporales: "hoy" y "este finde"
// ---------------------------------------------------------------------

/**
 * Desfase de Jaén en un instante dado, como "+02:00" o "+01:00". Se
 * consulta a Intl en vez de fijarlo, para que el cambio de hora de
 * octubre no descuadre los rangos.
 */
function desfaseMadrid(momento: Date) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    timeZoneName: "longOffset",
  }).formatToParts(momento);
  const nombre = partes.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  return nombre.replace("GMT", "") || "+00:00";
}

/** Fecha del día en Jaén, "YYYY-MM-DD". */
function diaMadrid(momento: Date) {
  const { day, month, year } = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(momento)
      .map((p) => [p.type, p.value])
  );
  return `${year}-${month}-${day}`;
}

/**
 * Medianoche en Jaén del día que cae `dias` después de `momento`, como
 * ISO con desfase explícito.
 *
 * El desfase se toma del instante de referencia; en el día del cambio de
 * hora el límite puede quedar desplazado una hora, lo que solo afectaría
 * a un evento que empiece exactamente a medianoche.
 */
function medianocheMadrid(momento: Date, dias = 0) {
  const base = new Date(momento.getTime() + dias * 86_400_000);
  return `${diaMadrid(base)}T00:00:00${desfaseMadrid(base)}`;
}

export type CorteTemporal = "hoy" | "manana" | "finde";

/**
 * Rango [desde, hasta) del corte pedido, en hora de Jaén.
 *
 * `desde` nunca es anterior a ahora: un corte es siempre un
 * subconjunto de los eventos vigentes, no una ventana al pasado.
 */
export function rangoTemporal(corte: CorteTemporal, ahora = new Date()) {
  if (corte === "hoy") {
    return { desde: ahora.toISOString(), hasta: medianocheMadrid(ahora, 1) };
  }

  // Mañana es un día entero, no "de aquí a 24 horas": empieza a
  // medianoche aunque ahora sean las once de la noche.
  if (corte === "manana") {
    return { desde: medianocheMadrid(ahora, 1), hasta: medianocheMadrid(ahora, 2) };
  }

  // getDay() sobre la fecha local del servidor no vale: se calcula el
  // día de la semana en Jaén. 0 = domingo.
  const diaSemana = new Date(`${diaMadrid(ahora)}T12:00:00Z`).getUTCDay();
  // Si ya es sábado o domingo, "este finde" es el que se está viviendo.
  const faltanParaSabado = diaSemana === 0 ? 0 : (6 - diaSemana + 7) % 7;
  const inicio = medianocheMadrid(ahora, faltanParaSabado);
  // El domingo cuenta entero: el corte termina el lunes a medianoche.
  const finDesplazamiento = diaSemana === 0 ? 1 : faltanParaSabado + 2;

  return {
    desde: new Date(inicio) > ahora ? inicio : ahora.toISOString(),
    hasta: medianocheMadrid(ahora, finDesplazamiento),
  };
}

/**
 * Filtro de eventos que caen dentro de [desde, hasta), equivalente a
 * `fecha_inicio < hasta and coalesce(fecha_fin, fecha_inicio) >= desde`.
 * La parte del coalesce va en el `or()`; la del `hasta`, aparte.
 */
export function filtroEventosEnRango(desde: string) {
  return `fecha_fin.gte.${desde},and(fecha_fin.is.null,fecha_inicio.gte.${desde})`;
}

// ---------------------------------------------------------------------
// Entrada de fechas desde el panel
// ---------------------------------------------------------------------

/**
 * Pasa el valor de un `<input type="datetime-local">` ("2026-09-15T20:00")
 * a ISO UTC interpretándolo SIEMPRE en hora de Jaén.
 *
 * Sin esto la fecha se interpretaría en la zona del servidor —en Vercel,
 * UTC— y un evento de las 22:00 se guardaría como las 22:00 UTC, o sea
 * las doce de la noche en Jaén.
 *
 * El desfase se calcula sobre el propio instante, así que el cambio de
 * hora solo puede desviar una hora a un evento que caiga dentro de la
 * madrugada del último domingo de marzo u octubre.
 */
export function isoDesdeHoraJaen(valorLocal: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valorLocal)) return null;

  const aproximado = new Date(`${valorLocal}:00Z`);
  if (Number.isNaN(aproximado.getTime())) return null;

  const fecha = new Date(`${valorLocal}:00${desfaseMadrid(aproximado)}`);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

/**
 * Instante en que un evento deja de estar vigente: fecha_fin si la hay,
 * o la medianoche de Jaén que cierra el día de fecha_inicio. Es hasta
 * cuándo dura la promoción de un evento.
 */
export function finEvento(fechaInicio: string, fechaFin: string | null) {
  if (fechaFin) return new Date(fechaFin).toISOString();
  return new Date(medianocheMadrid(new Date(fechaInicio), 1)).toISOString();
}

// ---------------------------------------------------------------------
// Eventos promocionados
// ---------------------------------------------------------------------

/**
 * Ventana de visibilidad de un evento promocionado antes de celebrarse.
 *
 * `promocionado_hasta` guarda el fin del evento, no el fin de la ventana:
 * un concierto de dentro de tres meses pagado hoy no "gasta" su promoción
 * en semanas en las que nadie mira esa fecha. Se promociona de verdad
 * cuando entra en estos días.
 */
export const DIAS_PROMOCION = 14;

/** Instante hasta el que se mira `fecha_inicio` para promocionar: ahora + DIAS_PROMOCION. */
export function limiteVentanaPromocion(ahora = new Date()) {
  return new Date(ahora.getTime() + DIAS_PROMOCION * 86_400_000).toISOString();
}

/**
 * Si un evento va arriba y con etiqueta en los listados públicos: tiene
 * promoción vigente y empieza dentro de la ventana (o ya ha empezado).
 */
export function estaPromocionado(
  promocionadoHasta: string | null,
  fechaInicio: string,
  ahora = new Date()
) {
  if (!promocionadoHasta) return false;
  const iso = ahora.toISOString();
  return promocionadoHasta > iso && fechaInicio < limiteVentanaPromocion(ahora);
}

/**
 * Promocionados primero, respetando el orden por fecha que ya trae la
 * lista. Para listados sin límite; con límite en SQL el promocionado
 * puede no venir en el resultado y hay que traerlo aparte.
 */
export function promocionadosPrimero<T extends { promocionado: boolean }>(lista: T[]): T[] {
  return [...lista.filter((e) => e.promocionado), ...lista.filter((e) => !e.promocionado)];
}

/** Medianoche en Jaén del día de un `<input type="date">`, en ISO UTC. */
export function isoDiaCompletoJaen(valorFecha: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valorFecha)) return null;
  return isoDesdeHoraJaen(`${valorFecha}T00:00`);
}

// FORMATO no vale aquí: da el mes abreviado ("sept.") y un
// datetime-local necesita "09".
const FORMATO_INPUT = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "2026-09-15T20:00" en hora de Jaén, para rellenar un datetime-local. */
export function horaJaenParaInput(iso: string): string {
  const p = Object.fromEntries(
    FORMATO_INPUT.formatToParts(new Date(iso)).map((x) => [x.type, x.value])
  ) as Partes;
  // en-CA devuelve la medianoche como "24"; el input espera "00".
  const hora = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hora}:${p.minute}`;
}

// ---------------------------------------------------------------------
// Crédito a la agenda de origen
// ---------------------------------------------------------------------

/**
 * Datos para el "vía EnJaén.es" de la tarjeta.
 *
 * El enlace va a la portada de la agenda y no a la ficha concreta
 * (`fuente_url`, que se enlaza desde la página del evento): en la
 * tarjeta el título ya lleva al detalle nuestro, y dos enlaces
 * externos ahí compiten con él.
 */
export function creditoFuente(
  fuenteNombre: string | null,
  fuenteUrl: string | null
): { nombre: string; sitio: string } | null {
  if (!fuenteNombre || !fuenteUrl) return null;

  try {
    return { nombre: fuenteNombre, sitio: new URL(fuenteUrl).origin };
  } catch {
    return null;
  }
}
