import * as cheerio from "cheerio";
import {
  isoEnJaen,
  limpiarTexto,
  numeroDeMes,
  type EventoImportado,
  type Fuente,
} from "./tipos";

// Agenda comunitaria de Jaén capital. Su robots.txt permite /eventos/ y
// no prohíbe agenda.asp; el listado se sirve desde la portada, en HTML.
const URL_PORTADA = "https://enjaen.es/";

// "sábado, 26 de septiembre de 2026" — el encabezado de cada día, tanto
// en los recomendados como en la agenda diaria.
const DIA = /(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i;

// El texto del enlace empieza por la hora: "21:30   Concierto: OBK (…)".
const HORA = /^(\d{1,2}):(\d{2})\s*(.*)$/;

// "Concierto: OBK (en Infanta Leonor)" → título y sitio.
const LUGAR = /^(.*?)\s*\(en\s+([^)]+)\)\s*$/;

/** Los enlaces de la portada mezclan http y www; se unifican. */
function normalizarEnlace(href: string) {
  const url = new URL(href, URL_PORTADA);
  url.protocol = "https:";
  url.hostname = url.hostname.replace(/^www\./, "");
  return url.toString();
}

async function obtener(): Promise<EventoImportado[]> {
  const respuesta = await fetch(URL_PORTADA, {
    headers: { "User-Agent": "JaenGuiaBot/1.0 (+https://jaenguia.com)" },
    cache: "no-store",
  });
  if (!respuesta.ok) throw new Error(`enjaen: HTTP ${respuesta.status}`);

  const $ = cheerio.load(await respuesta.text());
  const eventos: EventoImportado[] = [];

  // La fecha no cuelga del enlace: va suelta antes, como texto o como
  // encabezado de día. Se recorre el documento en orden y se arrastra la
  // última fecha vista, que es la que aplica al enlace siguiente.
  let ultimaFecha: { anio: number; mes: number; dia: number } | null = null;

  $("body")
    .find("*")
    .contents()
    .each((_, nodo) => {
      if (nodo.type === "text") {
        const encontrada = DIA.exec(limpiarTexto($(nodo).text()));
        if (encontrada) {
          const mes = numeroDeMes(encontrada[2]);
          if (mes) {
            ultimaFecha = {
              dia: Number(encontrada[1]),
              mes,
              anio: Number(encontrada[3]),
            };
          }
        }
        return;
      }

      if (nodo.type !== "tag" || nodo.name !== "a") return;

      const $enlace = $(nodo);
      const href = $enlace.attr("href") ?? "";
      if (!/agenda\.asp\?id=\d+/i.test(href)) return;
      if (!ultimaFecha) return;

      const conHora = HORA.exec(limpiarTexto($enlace.text()));
      if (!conHora) return;

      const fechaInicio = isoEnJaen(
        ultimaFecha.anio,
        ultimaFecha.mes,
        ultimaFecha.dia,
        Number(conHora[1]),
        Number(conHora[2])
      );
      if (!fechaInicio) return;

      const partes = LUGAR.exec(conHora[3]);
      const titulo = limpiarTexto(partes ? partes[1] : conHora[3]);
      if (titulo.length < 3) return;

      eventos.push({
        titulo,
        fechaInicio,
        esTodoElDia: false,
        lugarNombre: partes ? limpiarTexto(partes[2]) : null,
        municipioNombre: "Jaén",
        url: normalizarEnlace(href),
      });
    });

  return eventos;
}

export const enjaen: Fuente = {
  clave: "enjaen",
  nombre: "EnJaén.es",
  obtener,
};
