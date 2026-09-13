import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import CheckoutEmbebido from "@/components/panel/CheckoutEmbebido";
import { createClient } from "@/lib/supabase/server";
import { PRECIO_EVENTO_PROMOCIONADO, PRECIO_PLAN_DESTACADO, stripe, urlSitio } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Pago · Jaén Guía",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sesion?: string }>;
}

// Página de pago con el Checkout de Stripe embebido. La sesión la creó
// una acción de lib/actions/pagos.ts; aquí se recupera su client_secret tras
// comprobar que el usuario gestiona el negocio y que la sesión es de
// ese negocio (client_reference_id) y sigue abierta.
export default async function PagoPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { sesion: sesionId } = await searchParams;
  if (!sesionId) redirect(`/panel/${slug}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?volver=${encodeURIComponent(`/panel/${slug}`)}`);

  const { data: negocio } = await supabase
    .from("negocios")
    .select("id, nombre, miembros:negocios_miembros!inner(estado)")
    .eq("slug", slug)
    .eq("miembros.perfil_id", user.id)
    .eq("miembros.estado", "aprobado")
    .maybeSingle<{ id: string; nombre: string }>();
  if (!negocio) notFound();

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) redirect(`/panel/${slug}?error=${encodeURIComponent("Los pagos no están configurados todavía.")}`);

  let sesion;
  try {
    sesion = await stripe().checkout.sessions.retrieve(sesionId);
  } catch {
    redirect(`/panel/${slug}?error=${encodeURIComponent("La sesión de pago no existe.")}`);
  }

  if (sesion.client_reference_id !== negocio.id) notFound();
  if (sesion.status === "complete") {
    redirect(`/panel/${slug}?ok=${encodeURIComponent("Ese pago ya se hizo.")}`);
  }
  if (sesion.status !== "open" || !sesion.client_secret) {
    redirect(`/panel/${slug}?error=${encodeURIComponent("La sesión de pago ha caducado. Vuelve a intentarlo.")}`);
  }

  const esSuscripcion = sesion.mode === "subscription";
  // return_url es absoluta (Stripe la exige así); para router.push
  // basta con la ruta.
  const returnUrl = sesion.return_url ?? `${urlSitio()}/panel/${slug}`;
  const urlVuelta = returnUrl.replace(urlSitio(), "") || `/panel/${slug}`;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href={`/panel/${slug}`}
        className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-oliva-700 hover:text-terracota-600"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Volver sin pagar
      </Link>
      <header className="mt-4 mb-6">
        <h1 className="font-display text-3xl font-semibold text-oliva-900">
          {esSuscripcion ? "Plan Destacado" : "Promocionar evento"}
        </h1>
        <p className="mt-2 text-oliva-700">
          Para <strong>{negocio.nombre}</strong>. El cobro lo hace Stripe; tu tarjeta no pasa por Jaén Guía.
        </p>
      </header>
      <CheckoutEmbebido
        sesionId={sesion.id}
        clientSecret={sesion.client_secret}
        publishableKey={publishableKey}
        negocioNombre={negocio.nombre}
        esSuscripcion={esSuscripcion}
        precio={esSuscripcion ? PRECIO_PLAN_DESTACADO : PRECIO_EVENTO_PROMOCIONADO}
        urlVuelta={urlVuelta}
      />
    </main>
  );
}
