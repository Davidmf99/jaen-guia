import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { finEvento } from "@/lib/eventos";
import {
  enviarCorreos,
  emailsDeNegocio,
  avisarAdmin,
  euros,
  correoEventoPromocionado,
  correoPlanActivado,
  correoRenovacion,
  correoTarjetaRechazada,
  correoPlanPausadoImpago,
  correoSuscripcionFinalizada,
  correoAdminPagoRecibido,
  type Pago,
} from "@/lib/email";

// Único punto que convierte un cobro de Stripe en cambios de base de
// datos (migración 0016). Reglas:
//   · Firma obligatoria (STRIPE_WEBHOOK_SECRET). Sin ella, 400.
//   · Idempotente: el id del evento se apunta en stripe_eventos antes
//     de procesar; si ya estaba, 200 sin hacer nada.
//   · Siempre 200 tras procesar aunque no nos interese el evento; un
//     5xx haría que Stripe reintentase.
//   · Los correos van después del cambio en base de datos y nunca
//     lo deshacen: enviarCorreo no lanza.
//
// Local: stripe listen --forward-to localhost:3000/api/webhooks/stripe
// Eventos que hay que dar de alta en el endpoint (test y live):
//   checkout.session.completed, customer.subscription.deleted,
//   customer.subscription.updated, invoice.paid

export const runtime = "nodejs";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

interface NegocioCorreo {
  id: string;
  nombre: string;
  slug: string;
}

export async function POST(req: Request) {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET;
  const firma = req.headers.get("stripe-signature");
  if (!secreto || !firma) {
    return NextResponse.json({ error: "Falta la firma o STRIPE_WEBHOOK_SECRET" }, { status: 400 });
  }

  // constructEvent necesita el cuerpo crudo, no parseado.
  const cuerpo = await req.text();
  let evento: Stripe.Event;
  try {
    evento = stripe().webhooks.constructEvent(cuerpo, firma, secreto);
  } catch (err) {
    console.warn("[stripe] firma inválida:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error("[stripe] sin SUPABASE_SERVICE_ROLE_KEY: no se puede procesar", evento.id);
    return NextResponse.json({ error: "Sin acceso a base de datos" }, { status: 500 });
  }

  const { error: yaVisto } = await admin.from("stripe_eventos").insert({ id: evento.id, tipo: evento.type });
  if (yaVisto) {
    // 23505 = ya procesado. Cualquier otro error también devuelve 200:
    // no queremos que Stripe reintente eternamente por un fallo nuestro,
    // pero sí dejarlo en el log.
    if (yaVisto.code !== "23505") console.error("[stripe] no se pudo registrar", evento.id, yaVisto.message);
    return NextResponse.json({ received: true, duplicado: yaVisto.code === "23505" });
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed":
        await sesionCompletada(admin, evento.data.object);
        break;
      case "customer.subscription.deleted":
        await suscripcionBorrada(admin, evento.data.object);
        break;
      case "customer.subscription.updated":
        await suscripcionActualizada(admin, evento.data.object, evento.data.previous_attributes);
        break;
      case "invoice.paid":
        await facturaPagada(admin, evento.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe] error procesando", evento.id, evento.type, err);
    // Ya está apuntado en stripe_eventos: se borra para que el reintento
    // de Stripe pueda volver a entrar.
    await admin.from("stripe_eventos").delete().eq("id", evento.id);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function sesionCompletada(admin: Admin, sesion: Stripe.Checkout.Session) {
  const tipo = sesion.metadata?.tipo;
  const emailPagador = sesion.customer_details?.email ?? sesion.customer_email ?? null;

  if (tipo === "evento_promocionado") {
    const eventoId = sesion.metadata?.evento_id;
    if (!eventoId) throw new Error("checkout evento_promocionado sin evento_id");
    const evento = await promocionarEvento(admin, eventoId);

    if (evento.negocio) {
      const pago = await datosPago(sesion.invoice, sesion.amount_total);
      await enviarCorreos(
        await destinatarios(admin, evento.negocio.id, emailPagador),
        correoEventoPromocionado({ negocio: evento.negocio, evento, pago })
      );
      await avisarAdmin(
        correoAdminPagoRecibido({ negocio: evento.negocio, concepto: `evento promocionado: ${evento.titulo}`, pago, email: emailPagador })
      );
    }
    return;
  }

  if (tipo === "plan_destacado") {
    const negocioId = sesion.metadata?.negocio_id ?? sesion.client_reference_id;
    if (!negocioId) throw new Error("checkout plan_destacado sin negocio_id");
    const customer = typeof sesion.customer === "string" ? sesion.customer : sesion.customer?.id ?? null;
    const subscription =
      typeof sesion.subscription === "string" ? sesion.subscription : sesion.subscription?.id ?? null;

    const { data, error } = await admin
      .from("negocios")
      .update({ plan: "destacado", stripe_customer_id: customer, stripe_subscription_id: subscription })
      .eq("id", negocioId)
      .select("id, nombre, slug")
      .maybeSingle<NegocioCorreo>();
    if (error) throw error;
    if (!data) throw new Error(`negocio ${negocioId} no existe`);

    await promocionarEventosPendientes(admin, negocioId);
    revalidarNegocio(data.slug);

    // En suscripción la factura cuelga de la suscripción, no de la sesión.
    const factura = subscription ? await primeraFactura(subscription) : null;
    const pago = await datosPago(factura?.id ?? sesion.invoice, sesion.amount_total);
    await enviarCorreos(
      await destinatarios(admin, data.id, emailPagador),
      correoPlanActivado({ negocio: data, pago, finPeriodo: factura ? finPeriodoFactura(factura) : null })
    );
    await avisarAdmin(correoAdminPagoRecibido({ negocio: data, concepto: "plan Destacado (alta)", pago, email: emailPagador }));
    return;
  }

  console.warn("[stripe] checkout.session.completed sin tipo conocido", sesion.id, tipo);
}

/**
 * Renovación mensual cobrada. La primera factura (subscription_create)
 * ya se cuenta en checkout.session.completed; aquí solo los ciclos.
 */
async function facturaPagada(admin: Admin, factura: Stripe.Invoice) {
  if (factura.billing_reason !== "subscription_cycle") return;
  const subscriptionId = idSuscripcion(factura);
  if (!subscriptionId) return;

  const negocio = await negocioPorSuscripcion(admin, subscriptionId);
  if (!negocio) return;

  const pago = await datosPago(factura.id, factura.amount_paid);
  await enviarCorreos(
    await destinatarios(admin, negocio.id, factura.customer_email),
    correoRenovacion({ negocio, pago, finPeriodo: finPeriodoFactura(factura) })
  );
  await avisarAdmin(correoAdminPagoRecibido({ negocio, concepto: "plan Destacado (renovación)", pago, email: factura.customer_email }));
}

/**
 * Impago y recuperación. El primer rechazo de tarjeta NO baja el plan:
 * Stripe reintenta durante días (Smart Retries) y mientras tanto la
 * suscripción está en past_due, que ya se enseña como "Pago pendiente"
 * en /panel/[slug]/suscripcion; al dueño se le avisa por correo para
 * que cambie la tarjeta. Solo cuando Stripe se rinde y la marca
 * unpaid (ajuste de la cuenta: "marcar como impagada"; si el ajuste es
 * "cancelar", llega customer.subscription.deleted) se pasa a gratis.
 *
 * Se conserva stripe_subscription_id para que, si el dueño paga la
 * factura pendiente y la suscripción vuelve a active, se le restaure el
 * plan sin pasar otra vez por el checkout.
 */
async function suscripcionActualizada(
  admin: Admin,
  sub: Stripe.Subscription,
  anterior: Partial<Stripe.Subscription> | undefined
) {
  if (sub.status === "past_due" && anterior?.status && anterior.status !== "past_due") {
    const negocio = await negocioPorSuscripcion(admin, sub.id);
    if (!negocio) return;
    const importe = euros(sub.items.data[0]?.price.unit_amount ?? 0);
    await enviarCorreos(await destinatarios(admin, negocio.id), correoTarjetaRechazada({ negocio, importe }));
    return;
  }

  if (sub.status === "unpaid") {
    const negocio = await bajaDestacado(admin, sub.id, "impago tras los reintentos", { conservarSuscripcion: true });
    if (negocio) await enviarCorreos(await destinatarios(admin, negocio.id), correoPlanPausadoImpago(negocio));
    return;
  }

  if (sub.status === "active") {
    const { data, error } = await admin
      .from("negocios")
      .update({ plan: "destacado" })
      .eq("stripe_subscription_id", sub.id)
      .neq("plan", "destacado")
      .select("id, slug")
      .maybeSingle<{ id: string; slug: string }>();
    if (error) throw error;
    // Lo normal: ya era destacado y el update no toca nada (renovación
    // mensual, cambio de tarjeta, cancel_at_period_end…).
    if (!data) return;
    console.info("[stripe] negocio", data.slug, "vuelve a destacado: suscripción activa de nuevo");
    await promocionarEventosPendientes(admin, data.id);
    revalidarNegocio(data.slug);
  }
}

async function suscripcionBorrada(admin: Admin, sub: Stripe.Subscription) {
  const negocio = await bajaDestacado(admin, sub.id, "suscripción cancelada");
  if (!negocio) return;
  const motivo = sub.cancellation_details?.reason === "payment_failed" ? "impago" : "solicitud";
  await enviarCorreos(await destinatarios(admin, negocio.id), correoSuscripcionFinalizada({ negocio, motivo }));
}

/** Los eventos publicados y futuros del negocio que aún no lo estén pasan a promocionados. */
async function promocionarEventosPendientes(admin: Admin, negocioId: string) {
  const { data: eventos } = await admin
    .from("eventos")
    .select("id, fecha_inicio, fecha_fin")
    .eq("negocio_id", negocioId)
    .eq("estado", "publicado")
    .is("promocionado_hasta", null)
    .gte("fecha_inicio", new Date().toISOString())
    .returns<{ id: string; fecha_inicio: string; fecha_fin: string | null }[]>();
  for (const e of eventos ?? []) {
    await admin.from("eventos").update({ promocionado_hasta: finEvento(e.fecha_inicio, e.fecha_fin) }).eq("id", e.id);
  }
}

interface EventoPromocionado {
  id: string;
  titulo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  negocio: NegocioCorreo | null;
}

async function promocionarEvento(admin: Admin, eventoId: string): Promise<EventoPromocionado> {
  const { data: evento, error } = await admin
    .from("eventos")
    .select("id, titulo, fecha_inicio, fecha_fin, negocio:negocios(id, nombre, slug)")
    .eq("id", eventoId)
    .maybeSingle<EventoPromocionado>();
  if (error) throw error;
  if (!evento) throw new Error(`evento ${eventoId} no existe`);

  // Hasta que el evento termine. La ventana de DIAS_PROMOCION antes la
  // aplica quien lo pinta (lib/stripe.ts), así el pago no caduca.
  const { error: errorUpdate } = await admin
    .from("eventos")
    .update({ promocionado_hasta: finEvento(evento.fecha_inicio, evento.fecha_fin) })
    .eq("id", evento.id);
  if (errorUpdate) throw errorUpdate;

  if (evento.negocio?.slug) revalidarNegocio(evento.negocio.slug);
  return evento;
}

async function bajaDestacado(
  admin: Admin,
  subscriptionId: string,
  motivo: string,
  { conservarSuscripcion = false } = {}
): Promise<NegocioCorreo | null> {
  const { data, error } = await admin
    .from("negocios")
    .update(conservarSuscripcion ? { plan: "gratis" } : { plan: "gratis", stripe_subscription_id: null })
    .eq("stripe_subscription_id", subscriptionId)
    .select("id, nombre, slug")
    .maybeSingle<NegocioCorreo>();
  if (error) throw error;
  if (!data) {
    // Suscripción que no es nuestra o negocio ya dado de baja: nada.
    console.warn("[stripe] baja sin negocio asociado", subscriptionId, motivo);
    return null;
  }
  console.info("[stripe] negocio", data.slug, "vuelve a gratis:", motivo);
  revalidarNegocio(data.slug);
  return data;
}

async function negocioPorSuscripcion(admin: Admin, subscriptionId: string) {
  const { data } = await admin
    .from("negocios")
    .select("id, nombre, slug")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle<NegocioCorreo>();
  return data;
}

// A quién se escribe por un negocio: sus miembros aprobados y, si es
// otro, el email que puso en el pago (pagó él, quiere su factura).
async function destinatarios(admin: Admin, negocioId: string, emailPagador: string | null = null) {
  const emails = await emailsDeNegocio(admin, negocioId);
  if (emailPagador) emails.push(emailPagador);
  return emails;
}

// Importe y factura para el correo. Stripe genera la factura (con IVA)
// en los dos productos: invoice_creation en el pago único y de serie
// en la suscripción. Si no se puede leer, el correo sale sin enlace.
async function datosPago(factura: string | Stripe.Invoice | null | undefined, importeCentimos: number | null): Promise<Pago> {
  const sinFactura: Pago = { importe: euros(importeCentimos ?? 0), numeroFactura: null, urlFactura: null };
  if (!factura) return sinFactura;
  try {
    const f = typeof factura === "string" ? await stripe().invoices.retrieve(factura) : factura;
    return {
      importe: euros(f.amount_paid || importeCentimos || 0),
      numeroFactura: f.number,
      urlFactura: f.hosted_invoice_url ?? null,
    };
  } catch (err) {
    console.warn("[stripe] no se pudo leer la factura", err instanceof Error ? err.message : err);
    return sinFactura;
  }
}

async function primeraFactura(subscriptionId: string) {
  try {
    const { data } = await stripe().invoices.list({ subscription: subscriptionId, limit: 1 });
    return data[0] ?? null;
  } catch {
    return null;
  }
}

function idSuscripcion(factura: Stripe.Invoice) {
  const sub = factura.parent?.subscription_details?.subscription;
  return typeof sub === "string" ? sub : sub?.id ?? null;
}

/** Fin del periodo que cubre la factura (= próxima renovación). */
function finPeriodoFactura(factura: Stripe.Invoice) {
  const fin = factura.lines.data[0]?.period.end;
  return fin ? new Date(fin * 1000).toISOString() : null;
}

function revalidarNegocio(slug: string) {
  revalidatePath("/");
  revalidatePath("/eventos");
  revalidatePath("/destacados");
  revalidatePath(`/negocio/${slug}`);
  revalidatePath(`/panel/${slug}`);
}
