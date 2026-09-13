"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CreditCard } from "lucide-react";
import { iniciarCambioTarjeta, aplicarTarjeta } from "@/lib/actions/suscripcion";

interface Props {
  slugNegocio: string;
  publishableKey: string;
}

// Misma apariencia que FormularioPago.tsx.
const APARIENCIA: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#a85326",
    colorText: "#333f1c",
    colorTextSecondary: "#4a5a2c",
    colorDanger: "#a85326",
    borderRadius: "12px",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontSizeBase: "16px",
  },
  rules: {
    ".Input": { border: "1px solid #e6e9d3", boxShadow: "none", padding: "10px 12px" },
    ".Input:focus": { border: "1px solid #8a9a5b", boxShadow: "none" },
    ".Label": { color: "#4a5a2c", fontWeight: "500", marginBottom: "4px" },
  },
};

// Cambio de tarjeta con formulario propio: un SetupIntent (acción
// iniciarCambioTarjeta) guarda la tarjeta en el cliente de Stripe y
// aplicarTarjeta la pone como método de cobro de la suscripción.
export default function CambiarTarjeta({ slugNegocio, publishableKey }: Props) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState(false);

  async function abrir() {
    setAbriendo(true);
    setError(null);
    const r = await iniciarCambioTarjeta(slugNegocio);
    setAbriendo(false);
    if ("error" in r) setError(r.error);
    else setClientSecret(r.clientSecret);
  }

  if (!clientSecret) {
    return (
      <div>
        <button
          type="button"
          onClick={abrir}
          disabled={abriendo}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-oliva-200 px-5 text-base font-semibold text-oliva-900 hover:border-oliva-900 transition-colors disabled:opacity-60"
        >
          <CreditCard size={18} aria-hidden="true" />
          {abriendo ? "Un momento…" : "Cambiar tarjeta"}
        </button>
        {error && <p role="alert" className="mt-2 text-sm font-semibold text-terracota-600">{error}</p>}
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: APARIENCIA, locale: "es" }}>
      <FormularioTarjeta slugNegocio={slugNegocio} onCancelar={() => setClientSecret(null)} />
    </Elements>
  );
}

function FormularioTarjeta({ slugNegocio, onCancelar }: { slugNegocio: string; onCancelar: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || enviando) return;
    setEnviando(true);
    setError(null);

    const r = await stripe.confirmSetup({ elements, redirect: "if_required" });
    if (r.error) {
      setError(r.error.message ?? "No hemos podido guardar la tarjeta.");
      setEnviando(false);
      return;
    }
    const pm = r.setupIntent.payment_method;
    const pmId = typeof pm === "string" ? pm : pm?.id;
    if (!pmId) {
      setError("Stripe no devolvió la tarjeta.");
      setEnviando(false);
      return;
    }
    const aplicado = await aplicarTarjeta(slugNegocio, pmId);
    if ("error" in aplicado) {
      setError(aplicado.error);
      setEnviando(false);
      return;
    }
    router.push(`/panel/${slugNegocio}/suscripcion?ok=${encodeURIComponent("Tarjeta actualizada.")}`);
    router.refresh();
  }

  return (
    <form onSubmit={guardar} className="space-y-4 rounded-2xl border border-oliva-100 bg-tierra-50 p-4">
      <p className="text-base font-medium text-oliva-700">Tarjeta nueva</p>
      <PaymentElement options={{ layout: "tabs", wallets: { link: "never" } }} />
      {error && <p role="alert" className="text-sm font-semibold text-terracota-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!stripe || enviando}
          className="inline-flex min-h-11 items-center rounded-full bg-oliva-900 px-5 text-base font-semibold text-white hover:bg-oliva-700 transition-colors disabled:opacity-60"
        >
          {enviando ? "Guardando…" : "Guardar tarjeta"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="inline-flex min-h-11 items-center rounded-full border border-oliva-200 px-5 text-base font-semibold text-oliva-900 hover:border-oliva-900 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
