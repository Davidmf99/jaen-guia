import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { finEvento } from "@/lib/eventos";

// Único punto que convierte un cobro de Stripe en cambios de base de
// datos (migración 0016). Reglas:
//   · Firma obligatoria (STRIPE_WEBHOOK_SECRET). Sin ella, 400.
//   · Idempotente: el id del evento se apunta en stripe_eventos antes
//     de procesar; si ya estaba, 200 sin hacer nada.
//   · Siempre 200 tras procesar aunque no nos interese el evento; un
//     5xx haría que Stripe reintentase.
//
// Local: stripe listen --forward-to localhost:3000/api/webhooks/stripe

export const runtime = "nodejs";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

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
        await bajaDestacado(admin, evento.data.object.id, "suscripción cancelada");
        break;
      case "invoice.payment_failed": {
        const sub = evento.data.object.parent?.subscription_details?.subscription;
        const subId = typeof sub === "string" ? sub : sub?.id;
        if (subId) await bajaDestacado(admin, subId, "pago fallido");
        break;
      }
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

  if (tipo === "evento_promocionado") {
    const eventoId = sesion.metadata?.evento_id;
    if (!eventoId) throw new Error("checkout evento_promocionado sin evento_id");
    await promocionarEvento(admin, eventoId);
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
      .select("slug")
      .maybeSingle<{ slug: string }>();
    if (error) throw error;
    if (!data) throw new Error(`negocio ${negocioId} no existe`);

    // Los eventos que ya tenía publicados pasan a promocionados también.
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

    revalidarNegocio(data.slug);
    return;
  }

  console.warn("[stripe] checkout.session.completed sin tipo conocido", sesion.id, tipo);
}

async function promocionarEvento(admin: Admin, eventoId: string) {
  const { data: evento, error } = await admin
    .from("eventos")
    .select("id, fecha_inicio, fecha_fin, negocio:negocios(slug)")
    .eq("id", eventoId)
    .maybeSingle<{ id: string; fecha_inicio: string; fecha_fin: string | null; negocio: { slug: string } | null }>();
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
}

async function bajaDestacado(admin: Admin, subscriptionId: string, motivo: string) {
  const { data, error } = await admin
    .from("negocios")
    .update({ plan: "gratis", stripe_subscription_id: null })
    .eq("stripe_subscription_id", subscriptionId)
    .select("slug")
    .maybeSingle<{ slug: string }>();
  if (error) throw error;
  if (!data) {
    // Suscripción que no es nuestra o negocio ya dado de baja: nada.
    console.warn("[stripe] baja sin negocio asociado", subscriptionId, motivo);
    return;
  }
  console.info("[stripe] negocio", data.slug, "vuelve a gratis:", motivo);
  revalidarNegocio(data.slug);
}

function revalidarNegocio(slug: string) {
  revalidatePath("/");
  revalidatePath("/eventos");
  revalidatePath("/destacados");
  revalidatePath(`/negocio/${slug}`);
  revalidatePath(`/panel/${slug}`);
}
