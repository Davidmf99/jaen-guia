// ⚠️ FUENTE PAUSADA: no está en FUENTES (ver ./index.ts). Su aviso legal
// exige autorización expresa para reutilizar sus contenidos de manera
// habitual para uso público, y no la tenemos. El parser se conserva
// funcionando para el día que llegue esa autorización.

import * as cheerio from "cheerio";
import {
  isoEnJaen,
  limpiarTexto,
  numeroDeMes,
  type EventoImportado,
  type Fuente,
} from "./tipos";

// Feed oficial del Ayuntamiento: "actividades de los próximos 10 días".
// Se usa el RSS y no la agenda en HTML a propósito: es el formato que el
// propio Ayuntamiento publica para ser consumido por máquinas.
const URL_FEED =
  "https://www.aytojaen.es/portal/p_147_rss.jsp?codbusqueda=549&language=es";

// El feed va en iso-8859-1 y lo declara solo en la cabecera XML: sin
// decodificarlo a mano, "Jaén" llega como "Ja?n".
const CHARSET = "iso-8859-1";

// "De 05 jul. 2026 a 25 oct. 2026" dentro del <description>. El feed no
// da hora: estos eventos entran como de día completo.
const RANGO = /De\s+(\d{1,2})\s+([a-záéíóúñ.]+)\s+(\d{4})\s+a\s+(\d{1,2})\s+([a-záéíóúñ.]+)\s+(\d{4})/i;

/** Los enlaces del feed llevan el puerto pegado: "aytojaen.es:443/...". */
function limpiarUrl(url: string) {
  return url.replace(":443", "").replace(/^http:/, "https:").trim();
}

async function obtener(): Promise<EventoImportado[]> {
  const respuesta = await fetch(URL_FEED, {
    headers: { "User-Agent": "JaenGuiaBot/1.0 (+https://jaenguia.com)" },
    cache: "no-store",
  });
  if (!respuesta.ok) throw new Error(`RSS aytojaen: HTTP ${respuesta.status}`);

  const xml = new TextDecoder(CHARSET).decode(await respuesta.arrayBuffer());
  const $ = cheerio.load(xml, { xmlMode: true });

  const eventos: EventoImportado[] = [];

  $("item").each((_, item) => {
    const $item = $(item);
    const titulo = limpiarTexto($item.find("title").first().text());
    const url = limpiarUrl($item.find("link").first().text());
    if (!titulo || !url) return;

    const rango = RANGO.exec($item.find("description").first().text());
    if (!rango) return;

    const mesInicio = numeroDeMes(rango[2]);
    const mesFin = numeroDeMes(rango[5]);
    if (!mesInicio || !mesFin) return;

    const fechaInicio = isoEnJaen(Number(rango[3]), mesInicio, Number(rango[1]));
    const fechaFin = isoEnJaen(Number(rango[6]), mesFin, Number(rango[4]), 23, 59);
    if (!fechaInicio) return;

    eventos.push({
      titulo,
      fechaInicio,
      // Un rango de un solo día no es un rango: se guarda sin fecha_fin.
      fechaFin: fechaFin && fechaFin > fechaInicio ? fechaFin : null,
      esTodoElDia: true,
      municipioNombre: "Jaén",
      url,
    });
  });

  return eventos;
}

export const aytojaen: Fuente = {
  clave: "aytojaen",
  nombre: "Ayuntamiento de Jaén",
  obtener,
};
