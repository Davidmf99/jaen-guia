import "server-only";

// Envío de correo por la API HTTP de Resend, sin SDK: es una sola
// llamada POST y así no se añade dependencia. Si falta RESEND_API_KEY
// no se envía nada, se deja traza en el log y el flujo continúa: un
// correo que no sale nunca debe romper una aprobación.

interface Correo {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

export async function enviarCorreo(correo: Correo): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Jaén Guía <onboarding@resend.dev>";

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY no definida; no se envía "${correo.asunto}" a ${correo.para}`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [correo.para],
        subject: correo.asunto,
        html: correo.html,
        text: correo.texto,
      }),
    });
    if (!res.ok) {
      console.error(`[email] Resend ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] fallo de red:", err);
    return false;
  }
}

function urlSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function escapar(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Plantilla mínima, sin imágenes ni CSS externo: los clientes de correo
// respetan poco más que texto, enlaces y un botón con estilos en línea.
function plantilla(titulo: string, parrafos: string[], boton?: { texto: string; url: string }) {
  const cuerpo = parrafos.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#333f1c">${p}</p>`).join("");
  const cta = boton
    ? `<p style="margin:24px 0 0"><a href="${boton.url}" style="display:inline-block;background:#333f1c;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${escapar(boton.texto)}</a></p>`
    : "";
  return `<!doctype html><html lang="es"><body style="margin:0;background:#faf6f0;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
  <p style="margin:0 0 24px;font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#a85326;font-weight:700">Jaén Guía</p>
  <h1 style="margin:0 0 20px;font-size:24px;color:#333f1c">${escapar(titulo)}</h1>
  ${cuerpo}${cta}
  <p style="margin:32px 0 0;font-size:13px;color:#6a7743">Recibes este correo porque pediste gestionar un negocio en Jaén Guía.</p>
</div></body></html>`;
}

export function correoSolicitudAprobada(negocio: { nombre: string; slug: string }) {
  const url = `${urlSitio()}/panel/${negocio.slug}`;
  return {
    asunto: `Ya puedes gestionar ${negocio.nombre} en Jaén Guía`,
    html: plantilla(
      `${negocio.nombre} es tuyo`,
      [
        `Hemos comprobado la solicitud y ya puedes editar la ficha de <strong>${escapar(negocio.nombre)}</strong>: horarios, foto de portada, especialidades, servicios y eventos.`,
        "Cuanto más completa esté la ficha, más arriba sale y más gente la guarda.",
      ],
      { texto: "Editar mi ficha", url }
    ),
    texto: `Ya puedes gestionar ${negocio.nombre} en Jaén Guía.\n\nEdita la ficha en: ${url}`,
  };
}

export function correoSolicitudRechazada(negocio: { nombre: string }) {
  const url = `${urlSitio()}/contacto`;
  return {
    asunto: `Sobre tu solicitud para ${negocio.nombre}`,
    html: plantilla(
      "No hemos podido confirmar la solicitud",
      [
        `No hemos podido verificar que gestionas <strong>${escapar(negocio.nombre)}</strong>, así que de momento no le hemos dado acceso a esta cuenta.`,
        "Si crees que es un error, escríbenos y lo revisamos contigo.",
      ],
      { texto: "Escribir a Jaén Guía", url }
    ),
    texto: `No hemos podido confirmar que gestionas ${negocio.nombre}. Si crees que es un error, escríbenos: ${url}`,
  };
}

export function correoBorradoresNuevos(negocio: { nombre: string; slug: string }, cuantos: number) {
  const url = `${urlSitio()}/panel/${negocio.slug}#borradores`;
  const n = cuantos === 1 ? "1 evento nuevo" : `${cuantos} eventos nuevos`;
  return {
    asunto: `${n} para revisar en ${negocio.nombre}`,
    html: plantilla(
      `Hemos visto ${n} en tu Facebook o Instagram`,
      [
        `Lo hemos leído y lo tienes preparado en el panel de <strong>${escapar(negocio.nombre)}</strong>. Revisa el título y la hora y publícalo con un toque.`,
        "Nada sale en la agenda de Jaén Guía sin que lo confirmes tú.",
      ],
      { texto: "Revisar y publicar", url }
    ),
    texto: `Hemos visto ${n} en tu Facebook o Instagram. Revísalo y publícalo en: ${url}`,
  };
}
