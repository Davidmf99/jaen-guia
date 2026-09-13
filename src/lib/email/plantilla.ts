// Plantilla base de todos los correos transaccionales. Tablas y estilos
// en línea: es lo único que respetan Gmail, Outlook y el correo de
// Apple. Sin imágenes remotas (Gmail las bloquea hasta que el usuario
// las acepta) ni CSS externo. Misma paleta que la web (globals.css).

import { urlSitio } from "@/lib/sitio";

export const EMAIL_CONTACTO = "hola@jaenguia.com";

export interface CorreoListo {
  asunto: string;
  html: string;
  texto: string;
}

export interface OpcionesCorreo {
  asunto: string;
  /** Texto corto que enseñan Gmail/Apple debajo del asunto. */
  resumen?: string;
  titulo: string;
  /** Párrafos en HTML ya escapado (usar `n()` para lo que venga de fuera). */
  parrafos: string[];
  /** Caja con datos clave (importe, fecha, factura…). */
  detalles?: [string, string][];
  boton?: { texto: string; url: string };
  /** Párrafos pequeños bajo el botón. */
  notas?: string[];
  /** Por qué recibe el correo. Va en el pie. */
  motivo?: string;
}

const COLOR = {
  fondo: "#faf6f0",
  tarjeta: "#ffffff",
  borde: "#ece5d8",
  tinta: "#333f1c",
  suave: "#6a7743",
  acento: "#a85326",
  caja: "#f6f1e7",
};

const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapar(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Nombre propio (negocio, evento, persona) resaltado y escapado. */
export function n(s: string) {
  return `<strong style="color:${COLOR.tinta}">${escapar(s)}</strong>`;
}

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "eur" });

export function euros(centimos: number) {
  return EUR.format(centimos / 100);
}

export function fechaLarga(iso: string | Date) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

export function fechaCorta(iso: string | Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(
    new Date(iso)
  );
}

function sinEtiquetas(html: string) {
  return html
    .replace(/<br\s*\/?>/g, "\n")
    // Los enlaces conservan la URL: "texto (https://…)".
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function correo(o: OpcionesCorreo): CorreoListo {
  const p = (html: string) =>
    `<p style="margin:0 0 16px;font-family:${FUENTE};font-size:16px;line-height:1.55;color:${COLOR.tinta}">${html}</p>`;

  const detalles = o.detalles?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 24px;border-collapse:separate;background:${COLOR.caja};border-radius:12px">
${o.detalles
  .map(
    ([k, v], i) => `<tr>
  <td style="padding:${i === 0 ? 16 : 8}px 18px ${i === o.detalles!.length - 1 ? 16 : 8}px;font-family:${FUENTE};font-size:14px;color:${COLOR.suave};width:42%">${escapar(k)}</td>
  <td style="padding:${i === 0 ? 16 : 8}px 18px ${i === o.detalles!.length - 1 ? 16 : 8}px 0;font-family:${FUENTE};font-size:15px;font-weight:600;color:${COLOR.tinta}">${escapar(v)}</td>
</tr>`
  )
  .join("\n")}
</table>`
    : "";

  const boton = o.boton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr>
  <td style="background:${COLOR.tinta};border-radius:999px">
    <a href="${escapar(o.boton.url)}" style="display:inline-block;padding:13px 26px;font-family:${FUENTE};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none">${escapar(o.boton.texto)}</a>
  </td>
</tr></table>`
    : "";

  const notas = (o.notas ?? [])
    .map((t) => `<p style="margin:0 0 10px;font-family:${FUENTE};font-size:14px;line-height:1.5;color:${COLOR.suave}">${t}</p>`)
    .join("");

  const motivo = o.motivo ?? "Recibes este correo porque tienes una cuenta en Jaén Guía.";
  const sitio = urlSitio();

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapar(o.asunto)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.fondo}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapar(o.resumen ?? o.titulo)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${COLOR.fondo}">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px">
    <tr><td style="padding:0 8px 18px">
      <a href="${sitio}" style="font-family:${FUENTE};font-size:13px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:${COLOR.acento};text-decoration:none">Jaén Guía</a>
    </td></tr>
    <tr><td style="background:${COLOR.tarjeta};border:1px solid ${COLOR.borde};border-radius:18px;padding:36px 32px">
      <h1 style="margin:0 0 20px;font-family:${FUENTE};font-size:24px;line-height:1.25;font-weight:700;color:${COLOR.tinta}">${escapar(o.titulo)}</h1>
      ${o.parrafos.map(p).join("\n      ")}
      ${detalles}
      ${boton}
      ${notas}
    </td></tr>
    <tr><td style="padding:22px 8px 0;font-family:${FUENTE};font-size:12px;line-height:1.6;color:${COLOR.suave}">
      ${escapar(motivo)}<br>
      Jaén Guía · Bares, restaurantes y planes de Jaén · <a href="mailto:${EMAIL_CONTACTO}" style="color:${COLOR.suave}">${EMAIL_CONTACTO}</a> · <a href="${sitio}" style="color:${COLOR.suave}">${sitio.replace(/^https?:\/\//, "")}</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const texto = [
    o.titulo.toUpperCase(),
    "",
    ...o.parrafos.map(sinEtiquetas),
    ...(o.detalles?.length ? ["", ...o.detalles.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(o.boton ? ["", `${o.boton.texto}: ${o.boton.url}`] : []),
    ...(o.notas?.length ? ["", ...o.notas.map(sinEtiquetas)] : []),
    "",
    "—",
    motivo,
    `Jaén Guía · ${EMAIL_CONTACTO} · ${sitio}`,
  ].join("\n");

  return { asunto: o.asunto, html, texto };
}
