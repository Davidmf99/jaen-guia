"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe, urlSitio } from "@/lib/stripe";

// Checkout de Stripe para los dos productos de pago. Aquí solo se abre
// la sesión; el que cambia la base de datos es el webhook
// (/api/webhooks/stripe) cuando Stripe confirma el cobro. Por eso las
// dos acciones verifican que el usuario gestiona el negocio (RLS
// aparte) pero no tocan eventos ni negocios.

function volverAlPanel(slug: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/${slug}?${tipo}=${encodeURIComponent(mensaje)}#eventos`);
}

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Pago único: promociona un evento del negocio hasta que se celebre. */
export async function iniciarPagoEventoPromocionado(formData: FormData) {
  const { supabase, user } = await usuarioActual();
  const eventoId = String(formData.get("evento_id") ?? "");
  const slugNegocio = String(formData.get("slug_negocio") ?? "");
  if (!eventoId) volverAlPanel(slugNegocio, "error", "Evento no encontrado.");

  // La RLS solo devuelve eventos de negocios que el usuario gestiona;
  // el !inner sobre negocios_miembros lo deja explícito.
  const { data: evento } = await supabase
    .from("eventos")
    .select(
      "id, titulo, fecha_inicio, fecha_fin, promocionado_hasta, negocio:negocios!inner(id, slug, nombre, plan, miembros:negocios_miembros!inner(perfil_id, estado))"
    )
    .eq("id", eventoId)
    .eq("negocio.miembros.perfil_id", user.id)
    .eq("negocio.miembros.estado", "aprobado")
    .maybeSingle<{
      id: string;
      titulo: string;
      fecha_inicio: string;
      fecha_fin: string | null;
      promocionado_hasta: string | null;
      negocio: { id: string; slug: string; nombre: string; plan: string };
    }>();

  if (!evento) volverAlPanel(slugNegocio, "error", "No puedes promocionar ese evento.");
  const slug = evento.negocio.slug;

  const ahora = new Date().toISOString();
  if ((evento.fecha_fin ?? evento.fecha_inicio) < ahora) volverAlPanel(slug, "error", "Ese evento ya ha pasado.");
  if (evento.promocionado_hasta && evento.promocionado_hasta > ahora) volverAlPanel(slug, "error", "Ese evento ya está promocionado.");
  if (evento.negocio.plan === "destacado") volverAlPanel(slug, "error", "Con el plan Destacado tus eventos ya van promocionados.");

  const precio = process.env.STRIPE_PRICE_EVENTO_PROMOCIONADO;
  if (!precio) volverAlPanel(slug, "error", "Los pagos no están configurados todavía.");

  const base = urlSitio();
  const sesion = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: precio, quantity: 1 }],
    customer_email: user.email ?? undefined,
    client_reference_id: evento.negocio.id,
    metadata: { tipo: "evento_promocionado", evento_id: evento.id, negocio_id: evento.negocio.id },
    success_url: `${base}/panel/${slug}?ok=${encodeURIComponent("Pago recibido: el evento se promociona en unos segundos.")}#eventos`,
    cancel_url: `${base}/panel/${slug}?error=${encodeURIComponent("Pago cancelado.")}#eventos`,
    locale: "es",
  });

  if (!sesion.url) volverAlPanel(slug, "error", "No hemos podido abrir el pago.");
  redirect(sesion.url);
}

/** Suscripción mensual: plan Destacado para un negocio. */
export async function iniciarPagoDestacado(formData: FormData) {
  const { supabase, user } = await usuarioActual();
  const negocioId = String(formData.get("negocio_id") ?? "");
  const slugNegocio = String(formData.get("slug_negocio") ?? "");
  if (!negocioId) volverAlPanel(slugNegocio, "error", "Negocio no encontrado.");

  const { data: negocio } = await supabase
    .from("negocios")
    .select("id, slug, nombre, plan, stripe_customer_id, miembros:negocios_miembros!inner(perfil_id, estado)")
    .eq("id", negocioId)
    .eq("miembros.perfil_id", user.id)
    .eq("miembros.estado", "aprobado")
    .maybeSingle<{ id: string; slug: string; nombre: string; plan: string; stripe_customer_id: string | null }>();

  if (!negocio) volverAlPanel(slugNegocio, "error", "No gestionas ese negocio.");
  const slug = negocio.slug;
  if (negocio.plan === "destacado") volverAlPanel(slug, "error", "Este negocio ya es Destacado.");

  const precio = process.env.STRIPE_PRICE_DESTACADO;
  if (!precio) volverAlPanel(slug, "error", "Los pagos no están configurados todavía.");

  const base = urlSitio();
  const metadata = { tipo: "plan_destacado", negocio_id: negocio.id };
  const sesion = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: precio, quantity: 1 }],
    // Si ya pagó antes reutilizamos su customer; si no, Stripe lo crea
    // con este email.
    ...(negocio.stripe_customer_id
      ? { customer: negocio.stripe_customer_id }
      : { customer_email: user.email ?? undefined }),
    client_reference_id: negocio.id,
    metadata,
    // También en la suscripción: los eventos de baja/impago llegan sin
    // la sesión de checkout.
    subscription_data: { metadata },
    success_url: `${base}/panel/${slug}?ok=${encodeURIComponent("Suscripción activada: tu negocio pasa a Destacado en unos segundos.")}`,
    cancel_url: `${base}/panel/${slug}?error=${encodeURIComponent("Pago cancelado.")}`,
    locale: "es",
  });

  if (!sesion.url) volverAlPanel(slug, "error", "No hemos podido abrir el pago.");
  redirect(sesion.url);
}
