import { limpiarTexto, type EventoImportado, type Fuente } from "./tipos";

// Universidad de Jaén: eventos.ujaen.es (Symposium) publica un RSS con
// los 20 próximos eventos. Universidad pública, información del sector
// público (Ley 37/2007); su robots.txt permite todo salvo el gestor de
// ficheros. Solo se importan los hechos (qué, cuándo, dónde) y el
// enlace, como en el resto de fuentes.
//
// El feed mezcla actos abiertos (seminario de flamenco, visitas
// culturales, presentaciones de libros) con trámites y avisos internos
// (encuestas, matrículas, reuniones informativas, stands). Los segundos
// se descartan por título; con 20 entradas no compensa pasarlos por el
// modelo.
const URL_RSS = "https://eventos.ujaen.es/rss/next.rss";

// Los congresos académicos también fuera: hay que estar inscrito, no
// son un plan para un vecino.
const RUIDO =
  /\b(encuesta|matr[ií]cula|inscripci[oó]n|plazo|convocatoria|reuni[oó]n informativa|stand|becas?|premio|sorteo|comparte coche|reto |challenge|elecciones|claustro|consejo de gobierno|congreso|conference|workshop)\b/i;

// "Aulario B4 (Flores de Lemus) — Universidad de Jaén" → lugar y, si lo
// dice, municipio. El campus está en Jaén capital; una visita cultural
// pone el pueblo de destino en el lugar.
function lugarYMunicipio(primerParrafo: string): { lugar: string | null; municipio: string | null } {
  const texto = limpiarTexto(primerParrafo);
  if (!texto) return { lugar: null, municipio: null };
  const partes = texto.split(/\s+[—–-]\s+/).map((p) => p.trim()).filter(Boolean);
  const lugar = partes[0] && !/universidad de ja[eé]n/i.test(partes[0]) ? partes[0] : null;
  return { lugar, municipio: "Jaén" };
}

async function obtener(): Promise<EventoImportado[]> {
  const respuesta = await fetch(URL_RSS, {
    headers: { "User-Agent": "JaenGuiaBot/1.0 (+https://jaenguia.com)" },
    cache: "no-store",
  });
  if (!respuesta.ok) throw new Error(`uja: HTTP ${respuesta.status}`);
  const xml = await respuesta.text();

  const eventos: EventoImportado[] = [];
  for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const campo = (tag: string) => item[1].match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? "";
    const titulo = limpiarTexto(campo("title").replace(/<!\[CDATA\[|\]\]>/g, ""));
    const url = limpiarTexto(campo("link")).replace(/^http:\/\//, "https://");
    const fecha = new Date(limpiarTexto(campo("pubDate")));
    if (!titulo || !url || Number.isNaN(fecha.getTime())) continue;
    if (RUIDO.test(titulo)) continue;

    const descripcion = campo("description").replace(/<!\[CDATA\[|\]\]>/g, "");
    // El cartel va inline en la descripción, con ruta relativa.
    const img = descripcion.match(/<img[^>]+src="([^"]+)"/)?.[1];
    const imagenUrl = img ? new URL(img, "https://eventos.ujaen.es/").toString() : null;
    const primerParrafo = descripcion.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1]?.replace(/<[^>]+>/g, " ") ?? "";
    const { lugar, municipio } = lugarYMunicipio(primerParrafo);

    // Symposium da hora siempre; 00:00 es "sin hora".
    const hhmm = fecha.toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" });
    eventos.push({
      titulo,
      fechaInicio: fecha.toISOString(),
      fechaFin: null,
      esTodoElDia: hhmm === "00:00",
      lugarNombre: lugar,
      municipioNombre: municipio,
      url,
      imagenUrl,
    });
  }
  return eventos;
}

export const uja: Fuente = {
  nombre: "Universidad de Jaén",
  clave: "uja",
  obtener,
};
