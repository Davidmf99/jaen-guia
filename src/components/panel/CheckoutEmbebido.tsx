"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Check } from "lucide-react";
import { pagoAplicado } from "@/lib/actions/pagos";

// Checkout de Stripe embebido (Managed Payments, ver lib/actions/pagos.ts).
// Lo nuestro es el resumen de la izquierda y la vuelta al panel; el
// formulario (correo, tarjeta, dirección, NIF, botón) lo pinta Stripe
// dentro de un iframe. Colores y tipografía se ajustan desde Stripe →
// Configuración → Branding, no desde aquí.

interface Props {
  sesionId: string;
  clientSecret: string;
  publishableKey: string;
  negocioNombre: string;
  esSuscripcion: boolean;
  /** Precio ya formateado para el resumen ("5 €", "14,99 €/mes"). */
  precio: string;
  /** A dónde volver cuando el pago se confirma sin redirección. */
  urlVuelta: string;
}

const VENTAJAS_PLAN = [
  "Tu ficha en la portada y arriba en su categoría, con insignia",
  "Todos tus eventos promocionados, sin pagar uno a uno",
];
const VENTAJAS_EVENTO = [
  "Arriba en la agenda y en la portada hasta que se celebre",
  "Pago único, sin suscripción",
];

export default function CheckoutEmbebido({
  sesionId,
  clientSecret,
  publishableKey,
  negocioNombre,
  esSuscripcion,
  precio,
  urlVuelta,
}: Props) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  const router = useRouter();
  const [activando, setActivando] = useState(false);
  const ventajas = esSuscripcion ? VENTAJAS_PLAN : VENTAJAS_EVENTO;

  // Pagado. El webhook tarda 1-3 s en escribir en la base de datos: se
  // espera (hasta ~12 s) para que el panel ya salga actualizado. Si
  // tarda más, se vuelve igual: el panel se refresca en cuanto llegue.
  async function completado() {
    setActivando(true);
    for (let i = 0; i < 8; i++) {
      if (await pagoAplicado(sesionId)) break;
      await new Promise((res) => setTimeout(res, 1500));
    }
    router.refresh();
    router.push(urlVuelta);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <aside className="order-2 rounded-2xl bg-oliva-900 p-6 text-white lg:order-1 lg:col-span-2">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-terracota-300">Resumen</p>
        <p className="mt-2 font-display text-2xl">{esSuscripcion ? "Plan Destacado" : "Evento promocionado"}</p>
        <p className="mt-1 text-white/70">Para {negocioNombre}</p>
        <ul className="mt-5 space-y-2 text-white/85">
          {ventajas.map((v) => (
            <li key={v} className="flex items-start gap-2">
              <Check size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-terracota-300" />
              <span>{v}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 border-t border-white/15 pt-4 font-display text-2xl">{precio}</p>
        <p className="mt-1 text-sm text-white/60">
          IVA incluido; el desglose exacto sale en el formulario.
          {esSuscripcion && " Se renueva cada mes. Cancelas cuando quieras desde tu panel; sin permanencia."}
        </p>
      </aside>

      <div className="order-1 rounded-2xl bg-white p-2 shadow-sm sm:p-4 lg:order-2 lg:col-span-3" aria-busy={activando}>
        {activando ? (
          <p role="status" className="px-4 py-10 text-center text-lg font-semibold text-oliva-900">
            Pago recibido, activando…
          </p>
        ) : (
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret, onComplete: completado }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        )}
        <p className="px-4 pb-2 pt-3 text-center text-sm text-oliva-600">
          Cobra Stripe en nombre de Jaén Guía y te manda el recibo y la factura. En tu extracto verás «LINK.COM* JAEN GUIA».
        </p>
      </div>
    </div>
  );
}
