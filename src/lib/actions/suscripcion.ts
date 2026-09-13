"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { stripe, urlSitio } from "@/lib/stripe";
import { negocioSuscrito } from "@/lib/suscripcion";

// Gestión de la suscripción del plan Destacado con página propia
// (/panel/[slug]/suscripcion): cancelar y reanudar van por la API con
// la suscripción guardada en negocios (0016); cambiar la tarjeta abre el
// portal de Stripe (ver abrirPortalTarjeta). El paso a 'gratis' cuando
// vence lo sigue haciendo el webhook.

function volver(slug: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/${slug}/suscripcion?${tipo}=${encodeURIComponent(mensaje)}`);
}

/** Cancela al final del periodo pagado: sigue Destacado hasta entonces. */
export async function cancelarSuscripcion(formData: FormData) {
  const slug = String(formData.get("slug_negocio") ?? "");
  const negocio = await negocioSuscrito(slug);
  if (!negocio.stripe_subscription_id) volver(slug, "error", "No hay ninguna suscripción activa.");

  try {
    await stripe().subscriptions.update(negocio.stripe_subscription_id, { cancel_at_period_end: true });
  } catch (err) {
    console.error("[stripe] cancelar:", err instanceof Error ? err.message : err);
    volver(slug, "error", "No hemos podido cancelar la suscripción. Inténtalo en un momento.");
  }
  revalidatePath(`/panel/${slug}`);
  volver(slug, "ok", "Suscripción cancelada. Sigues Destacado hasta el final del periodo pagado.");
}

/** Deshace la cancelación mientras el periodo no haya vencido. */
export async function reanudarSuscripcion(formData: FormData) {
  const slug = String(formData.get("slug_negocio") ?? "");
  const negocio = await negocioSuscrito(slug);
  if (!negocio.stripe_subscription_id) volver(slug, "error", "No hay ninguna suscripción.");

  try {
    await stripe().subscriptions.update(negocio.stripe_subscription_id, { cancel_at_period_end: false });
  } catch (err) {
    console.error("[stripe] reanudar:", err instanceof Error ? err.message : err);
    volver(slug, "error", "No hemos podido reanudar la suscripción.");
  }
  revalidatePath(`/panel/${slug}`);
  volver(slug, "ok", "Suscripción reanudada: se renovará con normalidad.");
}

/**
 * Cambiar la tarjeta: portal de Stripe y vuelta. Con Managed Payments
 * la API no deja tocar default_payment_method de la suscripción
 * ("cannot be updated for Subscriptions created by Checkout Sessions
 * with Managed Payments enabled"), y el flujo payment_method_update del
 * portal solo cambia el predeterminado del cliente, que la renovación
 * ignora: probado con un test clock, siguió cobrando la tarjeta vieja.
 * Lo único que funciona es el portal completo, donde el lápiz junto a
 * la tarjeta de la suscripción sí la cambia (y cobra la nueva al mes
 * siguiente, también probado).
 */
export async function abrirPortalTarjeta(formData: FormData) {
  const slug = String(formData.get("slug_negocio") ?? "");
  const negocio = await negocioSuscrito(slug);
  if (!negocio.stripe_customer_id) volver(slug, "error", "Este negocio no tiene cliente de pago.");

  let url: string;
  try {
    const sesion = await stripe().billingPortal.sessions.create({
      customer: negocio.stripe_customer_id,
      return_url: `${urlSitio()}/panel/${slug}/suscripcion`,
      locale: "es",
    });
    url = sesion.url;
  } catch (err) {
    console.error("[stripe] portal:", err instanceof Error ? err.message : err);
    volver(slug, "error", "No hemos podido abrir el cambio de tarjeta. Inténtalo en un momento.");
  }
  redirect(url);
}
