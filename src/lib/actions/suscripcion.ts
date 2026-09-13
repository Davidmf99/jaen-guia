"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { negocioSuscrito, type NegocioSuscrito } from "@/lib/suscripcion";
import { createClient } from "@/lib/supabase/server";
import { enviarCorreo, correoCancelacionProgramada, correoSuscripcionReanudada } from "@/lib/email";

// Gestión de la suscripción del plan Destacado con página propia
// (/panel/[slug]/suscripcion) en vez del portal de Stripe. Todo pasa
// por la API con la suscripción guardada en negocios (0016); el paso a
// 'gratis' cuando vence lo sigue haciendo el webhook.

function volver(slug: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/${slug}/suscripcion?${tipo}=${encodeURIComponent(mensaje)}`);
}

function finPeriodo(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  return item ? new Date(item.current_period_end * 1000).toISOString() : null;
}

// Confirmación por correo a quien acaba de tocar la suscripción (el
// usuario de la sesión, que negocioSuscrito ya ha comprobado que es
// miembro aprobado).
async function confirmarPorCorreo(negocio: NegocioSuscrito, correo: (n: NegocioSuscrito) => { asunto: string; html: string; texto: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) await enviarCorreo({ para: user.email, ...correo(negocio) });
}

/** Cancela al final del periodo pagado: sigue Destacado hasta entonces. */
export async function cancelarSuscripcion(formData: FormData) {
  const slug = String(formData.get("slug_negocio") ?? "");
  const negocio = await negocioSuscrito(slug);
  if (!negocio.stripe_subscription_id) volver(slug, "error", "No hay ninguna suscripción activa.");

  let sub: Stripe.Subscription;
  try {
    sub = await stripe().subscriptions.update(negocio.stripe_subscription_id, { cancel_at_period_end: true });
  } catch (err) {
    console.error("[stripe] cancelar:", err instanceof Error ? err.message : err);
    volver(slug, "error", "No hemos podido cancelar la suscripción. Inténtalo en un momento.");
  }
  await confirmarPorCorreo(negocio, (n) => correoCancelacionProgramada({ negocio: n, finPeriodo: finPeriodo(sub) }));
  revalidatePath(`/panel/${slug}`);
  volver(slug, "ok", "Suscripción cancelada. Sigues Destacado hasta el final del periodo pagado.");
}

/** Deshace la cancelación mientras el periodo no haya vencido. */
export async function reanudarSuscripcion(formData: FormData) {
  const slug = String(formData.get("slug_negocio") ?? "");
  const negocio = await negocioSuscrito(slug);
  if (!negocio.stripe_subscription_id) volver(slug, "error", "No hay ninguna suscripción.");

  let sub: Stripe.Subscription;
  try {
    sub = await stripe().subscriptions.update(negocio.stripe_subscription_id, { cancel_at_period_end: false });
  } catch (err) {
    console.error("[stripe] reanudar:", err instanceof Error ? err.message : err);
    volver(slug, "error", "No hemos podido reanudar la suscripción.");
  }
  await confirmarPorCorreo(negocio, (n) => correoSuscripcionReanudada({ negocio: n, finPeriodo: finPeriodo(sub) }));
  revalidatePath(`/panel/${slug}`);
  volver(slug, "ok", "Suscripción reanudada: se renovará con normalidad.");
}

/** SetupIntent para guardar una tarjeta nueva desde nuestro formulario. */
export async function iniciarCambioTarjeta(slug: string): Promise<{ clientSecret: string } | { error: string }> {
  const negocio = await negocioSuscrito(slug);
  if (!negocio.stripe_customer_id) return { error: "Este negocio no tiene cliente de pago." };
  try {
    const intent = await stripe().setupIntents.create({
      customer: negocio.stripe_customer_id,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: { negocio_id: negocio.id },
    });
    if (!intent.client_secret) return { error: "Stripe no devolvió la sesión." };
    return { clientSecret: intent.client_secret };
  } catch (err) {
    console.error("[stripe] setup:", err instanceof Error ? err.message : err);
    return { error: "No hemos podido iniciar el cambio de tarjeta." };
  }
}

/** Tras confirmar el SetupIntent: la tarjeta nueva pasa a cobrar la suscripción. */
export async function aplicarTarjeta(slug: string, paymentMethodId: string): Promise<{ ok: true } | { error: string }> {
  const negocio = await negocioSuscrito(slug);
  if (!negocio.stripe_customer_id || !negocio.stripe_subscription_id) return { error: "No hay suscripción que actualizar." };
  try {
    const api = stripe();
    // Comprobar que el método pertenece a este cliente antes de usarlo.
    const pm = await api.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== negocio.stripe_customer_id) return { error: "Tarjeta no válida." };
    await Promise.all([
      api.subscriptions.update(negocio.stripe_subscription_id, { default_payment_method: paymentMethodId }),
      api.customers.update(negocio.stripe_customer_id, { invoice_settings: { default_payment_method: paymentMethodId } }),
    ]);
  } catch (err) {
    console.error("[stripe] aplicar tarjeta:", err instanceof Error ? err.message : err);
    return { error: "No hemos podido guardar la tarjeta." };
  }
  revalidatePath(`/panel/${slug}/suscripcion`);
  return { ok: true };
}
