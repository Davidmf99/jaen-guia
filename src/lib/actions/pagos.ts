"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { stripe, urlSitio } from "@/lib/stripe";

// Checkout de Stripe para los dos productos de pago con formulario
// propio en /panel/[slug]/pago (ui_mode elements): el dueño no sale de
// Jaén Guía. Aquí solo se crea la sesión; el que cambia la base de datos es
// el webhook (/api/webhooks/stripe) cuando Stripe confirma el cobro.
// Por eso las dos acciones verifican que el usuario gestiona el
// negocio (RLS aparte) pero no tocan eventos ni negocios.

function volverAlPanel(slug: string, tipo: "ok" | "error", mensaje: string): never {
  redirect(`/panel/${slug}?${tipo}=${encodeURIComponent(mensaje)}#eventos`);
}

// Común a las dos sesiones:
//   · ui_mode "elements": formulario nuestro (FormularioPago.tsx).
//   · Managed Payments apagado: con él Stripe es el vendedor y solo
//     permite su Checkout. Aquí vende Jaén Guía: Stripe Tax calcula el
//     IVA (precios con IVA incluido, el total no cambia) y lo declaras tú.
//   · NIF y dirección: el formulario los manda con updateTaxIdInfo /
//     updateBillingAddress, así que van habilitados en la sesión.
const SESION_COMUN = {
  ui_mode: "elements",
  // Solo tarjeta: Klarna/Amazon Pay para 14,99 € al mes desconciertan
  // más que ayudan. Bizum o SEPA, si algún bar lo pide.
  payment_method_types: ["card"],
  managed_payments: { enabled: false },
  automatic_tax: { enabled: true },
  tax_id_collection: { enabled: true },
  billing_address_collection: "auto",
} satisfies Partial<Stripe.Checkout.SessionCreateParams>;

// Un fallo de Stripe (clave mala, precio sin tax_code, red) vuelve al
// panel con aviso en vez de tumbar la página con el error boundary.
async function crearSesion(slug: string, params: Stripe.Checkout.SessionCreateParams) {
  try {
    return await stripe().checkout.sessions.create(params);
  } catch (err) {
    console.error("[stripe] checkout:", err instanceof Error ? err.message : err);
    volverAlPanel(slug, "error", "No hemos podido abrir el pago. Inténtalo en un momento.");
  }
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

  const sesion = await crearSesion(slug, {
    mode: "payment",
    ...SESION_COMUN,
    // Pago único: factura automática para el bar (en suscripción ya la
    // genera cada cobro).
    invoice_creation: { enabled: true },
    line_items: [{ price: precio, quantity: 1 }],
    customer_email: user.email ?? undefined,
    client_reference_id: evento.negocio.id,
    metadata: { tipo: "evento_promocionado", evento_id: evento.id, negocio_id: evento.negocio.id },
    return_url: `${urlSitio()}/panel/${slug}?ok=${encodeURIComponent("Pago recibido: tu evento ya está promocionado.")}#eventos`,
    locale: "es",
  });

  redirect(`/panel/${slug}/pago?sesion=${sesion.id}`);
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

  const metadata = { tipo: "plan_destacado", negocio_id: negocio.id };
  const sesion = await crearSesion(slug, {
    mode: "subscription",
    ...SESION_COMUN,
    line_items: [{ price: precio, quantity: 1 }],
    // Si ya pagó antes reutilizamos su customer; si no, Stripe lo crea
    // con este email.
    // Con un customer existente, Stripe exige permiso para guardarle el
    // nombre (NIF) y la dirección (IVA) que mande el formulario.
    ...(negocio.stripe_customer_id
      ? { customer: negocio.stripe_customer_id, customer_update: { name: "auto", address: "auto" } }
      : { customer_email: user.email ?? undefined }),
    client_reference_id: negocio.id,
    metadata,
    // También en la suscripción: los eventos de baja/impago llegan sin
    // la sesión de checkout.
    subscription_data: { metadata },
    return_url: `${urlSitio()}/panel/${slug}?ok=${encodeURIComponent("Suscripción activada: tu negocio ya es Destacado.")}`,
    locale: "es",
  });

  redirect(`/panel/${slug}/pago?sesion=${sesion.id}`);
}

/**
 * ¿Ya está aplicado en la base de datos lo que se pagó en esa sesión?
 * El formulario lo consulta tras confirmar, para no mandar al dueño al
 * panel antes de que el webhook haya escrito (si no, ve el estado
 * antiguo). Lee con el cliente de sesión: la RLS ya limita a lo suyo.
 */
export async function pagoAplicado(sesionId: string): Promise<boolean> {
  const { supabase } = await usuarioActual();
  let sesion: Stripe.Checkout.Session;
  try {
    sesion = await stripe().checkout.sessions.retrieve(sesionId);
  } catch {
    return false;
  }

  const tipo = sesion.metadata?.tipo;
  if (tipo === "plan_destacado" && sesion.metadata?.negocio_id) {
    const { data } = await supabase.from("negocios").select("plan").eq("id", sesion.metadata.negocio_id).maybeSingle<{ plan: string }>();
    return data?.plan === "destacado";
  }
  if (tipo === "evento_promocionado" && sesion.metadata?.evento_id) {
    const { data } = await supabase
      .from("eventos")
      .select("promocionado_hasta")
      .eq("id", sesion.metadata.evento_id)
      .maybeSingle<{ promocionado_hasta: string | null }>();
    return Boolean(data?.promocionado_hasta);
  }
  return false;
}
