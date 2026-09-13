import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CorreoListo } from "./plantilla";

// Envío de correo por la API HTTP de Resend, sin SDK: es una sola
// llamada POST y así no se añade dependencia. Si falta RESEND_API_KEY
// no se envía nada, se deja traza en el log y el flujo continúa: un
// correo que no sale nunca debe romper una aprobación ni un cobro.
//
// Las plantillas están en correos.ts; la base visual en plantilla.ts.
// Los correos de Supabase Auth (confirmar cuenta, recuperar contraseña,
// cambiar email) están en supabase/templates/ y se configuran en su panel.

export * from "./correos";
export { EMAIL_CONTACTO, euros } from "./plantilla";

/** Buzón que recibe los avisos internos (solicitudes, cobros). */
export const EMAIL_ADMIN = process.env.EMAIL_ADMIN ?? "hola@jaenguia.com";

export async function enviarCorreo(correo: CorreoListo & { para: string; responderA?: string }): Promise<boolean> {
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
        reply_to: correo.responderA ?? EMAIL_ADMIN,
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

/** El mismo correo a varias direcciones (los miembros de un negocio). */
export async function enviarCorreos(paras: string[], correo: CorreoListo) {
  for (const para of new Set(paras)) await enviarCorreo({ para, ...correo });
}

/** Aviso al buzón interno. */
export function avisarAdmin(correo: CorreoListo) {
  return enviarCorreo({ para: EMAIL_ADMIN, ...correo });
}

// Emails de los miembros aprobados de un negocio. Viven en auth.users,
// que solo lee el cliente admin (service_role).
export async function emailsDeNegocio(admin: SupabaseClient, negocioId: string): Promise<string[]> {
  const { data: miembros } = await admin
    .from("negocios_miembros")
    .select("perfil_id")
    .eq("negocio_id", negocioId)
    .eq("estado", "aprobado");
  const emails: string[] = [];
  for (const m of miembros ?? []) {
    const { data } = await admin.auth.admin.getUserById(m.perfil_id as string);
    if (data?.user?.email) emails.push(data.user.email);
  }
  return emails;
}
