import "server-only";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

// Lecturas para /panel/[slug]/suscripcion. Van en un módulo server-only
// y no en actions/: exportar desde un archivo "use server" las
// convertiría en endpoints que cualquiera podría llamar con otro id.

export interface NegocioSuscrito {
  id: string;
  slug: string;
  nombre: string;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

/** Negocio gestionado por el usuario, o redirección si no. */
export async function negocioSuscrito(slug: string): Promise<NegocioSuscrito> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?volver=${encodeURIComponent(`/panel/${slug}/suscripcion`)}`);

  const { data } = await supabase
    .from("negocios")
    .select("id, slug, nombre, plan, stripe_customer_id, stripe_subscription_id, miembros:negocios_miembros!inner(perfil_id, estado)")
    .eq("slug", slug)
    .eq("miembros.perfil_id", user.id)
    .eq("miembros.estado", "aprobado")
    .maybeSingle<NegocioSuscrito>();
  if (!data) redirect("/panel");
  return data;
}

export interface ResumenSuscripcion {
  estado: Stripe.Subscription.Status;
  cancelaAlFinal: boolean;
  /** Fin del periodo pagado (ISO). */
  finPeriodo: string | null;
  importe: string;
  tarjeta: { marca: string; ultimos4: string; caducidad: string } | null;
  facturas: { id: string; fecha: string; importe: string; pagada: boolean; pdf: string | null }[];
}

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "eur" });

/** Lee de Stripe lo que enseña la página. null si no hay suscripción. */
export async function resumenSuscripcion(negocio: NegocioSuscrito): Promise<ResumenSuscripcion | null> {
  if (!negocio.stripe_subscription_id) return null;
  const api = stripe();

  const [sub, facturas] = await Promise.all([
    api.subscriptions.retrieve(negocio.stripe_subscription_id, { expand: ["default_payment_method"] }),
    api.invoices.list({ subscription: negocio.stripe_subscription_id, limit: 12 }),
  ]);

  const item = sub.items.data[0];
  const pm =
    sub.default_payment_method && typeof sub.default_payment_method !== "string"
      ? sub.default_payment_method
      : null;
  const tarjeta = pm?.card
    ? {
        marca: pm.card.brand,
        ultimos4: pm.card.last4,
        caducidad: `${String(pm.card.exp_month).padStart(2, "0")}/${String(pm.card.exp_year).slice(-2)}`,
      }
    : null;

  return {
    estado: sub.status,
    cancelaAlFinal: sub.cancel_at_period_end,
    finPeriodo: item ? new Date(item.current_period_end * 1000).toISOString() : null,
    importe: EUR.format((item?.price.unit_amount ?? 0) / 100),
    tarjeta,
    facturas: facturas.data.map((f) => ({
      id: f.id,
      fecha: new Date(f.created * 1000).toISOString(),
      importe: EUR.format((f.amount_paid || f.amount_due) / 100),
      pagada: f.status === "paid",
      pdf: f.invoice_pdf ?? f.hosted_invoice_url ?? null,
    })),
  };
}

