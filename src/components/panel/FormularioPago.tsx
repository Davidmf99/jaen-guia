"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
// Todo del entrypoint /checkout: el PaymentElement "normal" busca el
// contexto de <Elements>, no el de la sesión de Checkout.
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from "@stripe/react-stripe-js/checkout";
import { Check, Lock } from "lucide-react";
import { pagoAplicado } from "@/lib/actions/pagos";

// Checkout propio (Checkout Session con ui_mode "elements"): el
// resumen, los datos del comprador y el botón son nuestros; Stripe
// solo pone el campo de tarjeta (PaymentElement, iframe obligatorio
// para no entrar en PCI), calcula el IVA y confirma. Sin la sesión de
// Checkout detrás habría que llevar impuestos, 3DS y suscripciones a
// mano.

interface Props {
  clientSecret: string;
  publishableKey: string;
  /** Correo del usuario, precargado (se puede cambiar). */
  email: string;
  negocioNombre: string;
  esSuscripcion: boolean;
  /** A dónde volver cuando el pago se confirma sin redirección. */
  urlVuelta: string;
}

const CAMPO =
  "mt-1 w-full rounded-xl border border-oliva-100 bg-white px-3 py-2.5 text-base text-oliva-900 outline-none focus:border-oliva-400";
const ETIQUETA = "block text-base font-medium text-oliva-700";

// Misma paleta que globals.css para que el campo de tarjeta parezca uno
// más del formulario.
const APARIENCIA: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#a85326",
    colorText: "#333f1c",
    colorTextSecondary: "#4a5a2c",
    colorDanger: "#a85326",
    colorBackground: "#ffffff",
    borderRadius: "12px",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontSizeBase: "16px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #e6e9d3", boxShadow: "none", padding: "10px 12px" },
    ".Input:focus": { border: "1px solid #8a9a5b", boxShadow: "none" },
    ".Label": { color: "#4a5a2c", fontWeight: "500", marginBottom: "4px" },
    ".Tab, .Block": { border: "1px solid #e6e9d3", boxShadow: "none" },
  },
};

const VENTAJAS_PLAN = [
  "Tu ficha en la portada y arriba en su categoría, con insignia",
  "Todos tus eventos promocionados, sin pagar uno a uno",
  "Revisamos tu Instagram a mano cada semana, stories incluidas",
];
const VENTAJAS_EVENTO = [
  "Arriba en la agenda y en la portada hasta que se celebre",
  "Pago único, sin suscripción",
];

export default function FormularioPago(props: Props) {
  const stripePromise = useMemo(() => loadStripe(props.publishableKey), [props.publishableKey]);

  return (
    <CheckoutElementsProvider
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        elementsOptions: { appearance: APARIENCIA, loader: "auto" },
      }}
    >
      <Contenido {...props} />
    </CheckoutElementsProvider>
  );
}

function Contenido(props: Props) {
  const estado = useCheckoutElements();

  if (estado.type === "error") {
    return (
      <p role="alert" className="rounded-2xl bg-terracota-500/10 px-4 py-3 text-base font-semibold text-terracota-600">
        No hemos podido cargar el pago: {estado.error.message}
      </p>
    );
  }
  if (estado.type === "loading") {
    return <Esqueleto />;
  }
  return <Formulario {...props} checkout={estado.checkout} />;
}

type Checkout = Extract<ReturnType<typeof useCheckoutElements>, { type: "success" }>["checkout"];

function Formulario({ checkout, negocioNombre, esSuscripcion, urlVuelta, email: emailInicial }: Props & { checkout: Checkout }) {
  const router = useRouter();
  // El correo lo fija la sesión (customer / customer_email = el de la
  // cuenta): Stripe no deja cambiarlo desde aquí, así que se enseña y ya.
  const email = checkout.email ?? emailInicial;
  const [nombre, setNombre] = useState("");
  const [conFactura, setConFactura] = useState(false);
  const [empresa, setEmpresa] = useState(negocioNombre);
  const [nif, setNif] = useState("");
  const [direccion, setDireccion] = useState("");
  const [cp, setCp] = useState("");
  const [ciudad, setCiudad] = useState("Jaén");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  // Stripe Tax no calcula el IVA hasta saber el país; con España por
  // defecto el desglose sale desde el primer render. Si luego el dueño
  // rellena dirección completa, se vuelve a mandar al pagar.
  useEffect(() => {
    if (checkout.tax.status !== "ready") {
      void checkout.updateBillingAddress({ address: { country: "ES" } });
    }
    // Solo al montar: el estado de tax cambia justo por esta llamada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = checkout.total.total.amount;
  const impuestos = checkout.total.taxInclusive.amount;
  const ivaListo = checkout.tax.status === "ready";
  const ventajas = esSuscripcion ? VENTAJAS_PLAN : VENTAJAS_EVENTO;
  const producto = checkout.lineItems[0];

  async function pagar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setError(null);
    setEnviando(true);

    try {
      // Datos del comprador: se mandan a la sesión antes de confirmar
      // para que Stripe los tenga en la factura y el recibo.
      const rDireccion = await checkout.updateBillingAddress({
        name: conFactura ? empresa.trim() || nombre.trim() : nombre.trim(),
        address: {
          country: "ES",
          line1: conFactura ? direccion.trim() || null : null,
          postal_code: conFactura ? cp.trim() || null : null,
          city: conFactura ? ciudad.trim() || null : null,
        },
      });
      if (rDireccion.type === "error") throw new Error(rDireccion.error.message);

      if (conFactura && nif.trim()) {
        const rNif = await checkout.updateTaxIdInfo({
          taxId: { type: "es_cif", value: nif.trim().toUpperCase() },
          businessName: empresa.trim() || nombre.trim(),
        });
        if (rNif.type === "error") throw new Error(rNif.error.message);
      }

      // return_url ya va en la sesión (lib/actions/pagos.ts): aquí no se
      // repite o Stripe lo rechaza. Con tarjeta normal no redirige y
      // volvemos nosotros; con 3DS por redirección usa el de la sesión.
      const r = await checkout.confirm({ redirect: "if_required" });
      if (r.type === "error") throw new Error(r.error.message);

      // Pagado. El webhook tarda 1-3 s en escribir en la base de datos:
      // se espera (hasta ~12 s) para que el panel ya salga actualizado.
      setConfirmando(true);
      for (let i = 0; i < 8; i++) {
        if (await pagoAplicado(checkout.id)) break;
        await new Promise((res) => setTimeout(res, 1500));
      }
      router.refresh();
      router.push(urlVuelta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No hemos podido completar el pago.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={pagar} className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Resumen */}
      <aside className="order-2 rounded-2xl bg-oliva-900 p-6 text-white lg:order-1 lg:col-span-2">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-terracota-300">Resumen</p>
        <p className="mt-2 font-display text-2xl">{producto?.name ?? (esSuscripcion ? "Plan Destacado" : "Evento promocionado")}</p>
        <p className="mt-1 text-white/70">Para {negocioNombre}</p>
        <ul className="mt-5 space-y-2 text-white/85">
          {ventajas.map((v) => (
            <li key={v} className="flex items-start gap-2">
              <Check size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-terracota-300" />
              <span>{v}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-6 space-y-1.5 border-t border-white/15 pt-4 text-base">
          <div className="flex justify-between text-white/70">
            <dt>IVA (incluido)</dt>
            <dd>{ivaListo ? impuestos : "…"}</dd>
          </div>
          <div className="flex justify-between font-display text-2xl">
            <dt>Total</dt>
            <dd>
              {total}
              {esSuscripcion && <span className="text-base font-sans text-white/70"> /mes</span>}
            </dd>
          </div>
        </dl>
        {esSuscripcion && (
          <p className="mt-3 text-sm text-white/60">Se renueva cada mes. Cancelas cuando quieras desde tu panel; sin permanencia.</p>
        )}
      </aside>

      {/* Datos y pago */}
      <div className="order-1 space-y-4 rounded-2xl bg-white p-6 shadow-sm lg:order-2 lg:col-span-3">
        <div>
          <p className={ETIQUETA}>Correo para el recibo</p>
          <p className="mt-1 rounded-xl bg-tierra-50 px-3 py-2.5 text-base text-oliva-900">{email}</p>
          <p className="mt-1 text-sm text-oliva-600">El de tu cuenta. Si quieres otro para las facturas, cámbialo luego desde «Gestionar suscripción».</p>
        </div>
        <div>
          <label htmlFor="pago-nombre" className={ETIQUETA}>Nombre y apellidos</label>
          <input id="pago-nombre" type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} autoComplete="name" />
        </div>

        <label className="flex min-h-11 items-center gap-2.5 text-base text-oliva-700">
          <input type="checkbox" checked={conFactura} onChange={(e) => setConFactura(e.target.checked)} className="h-5 w-5 accent-terracota-600" />
          Necesito factura con NIF/CIF
        </label>

        {conFactura && (
          <div className="grid grid-cols-1 gap-4 rounded-xl bg-tierra-50 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="pago-empresa" className={ETIQUETA}>Razón social</label>
              <input id="pago-empresa" type="text" required={conFactura} value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={CAMPO} autoComplete="organization" />
            </div>
            <div>
              <label htmlFor="pago-nif" className={ETIQUETA}>NIF / CIF</label>
              <input id="pago-nif" type="text" required={conFactura} value={nif} onChange={(e) => setNif(e.target.value)} className={CAMPO} placeholder="B12345678" />
            </div>
            <div>
              <label htmlFor="pago-cp" className={ETIQUETA}>Código postal</label>
              <input id="pago-cp" type="text" required={conFactura} value={cp} onChange={(e) => setCp(e.target.value)} className={CAMPO} inputMode="numeric" autoComplete="postal-code" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pago-direccion" className={ETIQUETA}>Dirección</label>
              <input id="pago-direccion" type="text" required={conFactura} value={direccion} onChange={(e) => setDireccion(e.target.value)} className={CAMPO} autoComplete="street-address" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pago-ciudad" className={ETIQUETA}>Ciudad</label>
              <input id="pago-ciudad" type="text" required={conFactura} value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={CAMPO} autoComplete="address-level2" />
            </div>
          </div>
        )}

        <div>
          <p className={ETIQUETA}>Pago</p>
          <div className="mt-1">
            <PaymentElement
              options={{
                layout: "tabs",
                // Nombre, correo y dirección los mandamos nosotros con
                // updateBillingAddress: Stripe no permite pedir solo parte. Link
                // fuera: su bloque de "guarda tus datos" duplica campos y
                // despista en un formulario de un solo producto.
                fields: { billingDetails: { name: "never", email: "never", address: "never" } },
                wallets: { link: "never" },
              }}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-terracota-500/10 px-4 py-3 text-base font-semibold text-terracota-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando || !checkout.canConfirm}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-terracota-500 px-6 text-lg font-semibold text-white hover:bg-terracota-600 transition-colors disabled:opacity-60"
        >
          <Lock size={18} aria-hidden="true" />
          {confirmando
            ? "Pago recibido, activando…"
            : enviando
              ? "Procesando…"
              : esSuscripcion
                ? `Suscribirme por ${total}/mes`
                : `Pagar ${total}`}
        </button>
        <p className="text-center text-sm text-oliva-600">
          Pago seguro con Stripe. Tu tarjeta no pasa por Jaén Guía.
        </p>
      </div>
    </form>
  );
}

function Esqueleto() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5" aria-busy="true" aria-label="Cargando el pago">
      <div className="h-72 animate-pulse rounded-2xl bg-oliva-100 lg:col-span-2" />
      <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm lg:col-span-3" />
    </div>
  );
}
