import * as cheerio from "cheerio";
import {
  isoEnJaen,
  limpiarTexto,
  numeroDeMes,
  type EventoImportado,
  type Fuente,
} from "./tipos";

// Agenda Cultural de Andalucía (Consejería de Cultura), filtrada por la
// provincia de Jaén. Es información del sector público, sujeta a la Ley
// 37/2007 de reutilización, y su robots.txt no restringe esta sección.
const BASE = "https://www.juntadeandalucia.es";
const URL_PROVINCIA = `${BASE}/cultura/agendaculturaldeandalucia/jaen`;

// "Caseta municipal … - Villacarrillo (Jaén)" → sitio y municipio.
const MUNICIPIO = /^(.*?)\s*-\s*([^-]+?)\s*\((?:Jaén|Jaen)\)\s*$/i;

async function obtener(): Promise<EventoImportado[]> {
  const respuesta = await fetch(URL_PROVINCIA, {
    headers: { "User-Agent": "JaenGuiaBot/1.0 (+https://jaenguia.com)" },
    cache: "no-store",
  });
  if (!respuesta.ok) throw new Error(`agenda andalucía: HTTP ${respuesta.status}`);

  const $ = cheerio.load(await respuesta.text());
  const eventos: EventoImportado[] = [];

  // El listado tiene scroll infinito: esta primera página trae los
  // eventos más cercanos en el tiempo, que son justo los que interesan.
  $("article").each((_, articulo) => {
    const $articulo = $(articulo);

    const enlace = $articulo
      .find('a[href*="/agendaculturaldeandalucia/evento/"]')
      .first();
    const href = enlace.attr("href");
    if (!href) return;

    // El título es el texto del enlace que va dentro del bloque de
    // cabecera; el primer enlace de la tarjeta envuelve la imagen.
    const titulo = limpiarTexto(
      $articulo
        .find('a[href*="/agendaculturaldeandalucia/evento/"]')
        .map((_i, a) => $(a).text())
        .get()
        .find((texto) => limpiarTexto(texto).length > 3) ?? ""
    );
    if (!titulo) return;

    // La fecha va en el sello sobre la imagen: día, mes y año en tres
    // divs sueltos, sin ninguna clase que los identifique.
    const sello = limpiarTexto($articulo.find(".absolute").first().text());
    const partesFecha = /(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóúñ]+)\s+(\d{4})/.exec(sello);
    if (!partesFecha) return;

    const mes = numeroDeMes(partesFecha[2]);
    if (!mes) return;

    // La hora, cuando la hay, es un <p> con "22:00".
    const hora = /(\d{1,2}):(\d{2})/.exec($articulo.find("p").text());

    const fechaInicio = isoEnJaen(
      Number(partesFecha[3]),
      mes,
      Number(partesFecha[1]),
      hora ? Number(hora[1]) : 0,
      hora ? Number(hora[2]) : 0
    );
    if (!fechaInicio) return;

    const espacio = limpiarTexto(
      $articulo.find('a[href*="/agendaculturaldeandalucia/espacios/"]').first().text()
    );
    const conMunicipio = MUNICIPIO.exec(espacio);

    eventos.push({
      titulo,
      fechaInicio,
      esTodoElDia: !hora,
      lugarNombre: conMunicipio ? conMunicipio[1] : espacio || null,
      municipioNombre: conMunicipio ? conMunicipio[2] : null,
      url: new URL(href, BASE).toString(),
      imagenUrl: (() => {
        const src = $articulo.find("img").first().attr("src");
        return src ? new URL(src, BASE).toString() : null;
      })(),
    });
  });

  return eventos;
}

export const agendaAndalucia: Fuente = {
  clave: "agenda-andalucia",
  nombre: "Agenda Cultural de Andalucía",
  obtener,
};
