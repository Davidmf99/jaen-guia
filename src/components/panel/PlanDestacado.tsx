import { Star } from "lucide-react";
import { iniciarPagoDestacado } from "@/lib/actions/pagos";
import { PRECIO_PLAN_DESTACADO } from "@/lib/stripe";

interface Props {
  negocioId: string;
  slugNegocio: string;
  plan: string;
  /** false si faltan las claves de Stripe: no se enseña el botón. */
  disponible: boolean;
}

// Bloque del panel para pasar al plan Destacado (suscripción). Si el
// negocio ya lo tiene, solo se dice; la baja se gestiona desde Stripe.
export default function PlanDestacado({ negocioId, slugNegocio, plan, disponible }: Props) {
  if (plan === "destacado") {
    return (
      <section className="mt-10 rounded-2xl border border-oliva-100 bg-oliva-50 p-6">
        <p className="flex items-center gap-2 font-display text-xl font-semibold text-oliva-900">
          <Star size={20} strokeWidth={1.5} className="text-terracota-500" aria-hidden="true" />
          Tu negocio es Destacado
        </p>
        <p className="mt-1 text-base text-oliva-700">
          Sale arriba en la portada y en su categoría, y tus eventos se promocionan solos al publicarlos.
          Para cambiar el plan o darte de baja, escríbenos.
        </p>
      </section>
    );
  }

  if (!disponible) return null;

  return (
    <section className="mt-10 rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-oliva-900">
            <Star size={24} strokeWidth={1.5} className="text-terracota-500" aria-hidden="true" />
            Hazte Destacado
          </h2>
          <p className="mt-1 text-base text-oliva-700">
            Tu ficha arriba en la portada y en tu categoría, y todos tus eventos promocionados sin pagar
            uno a uno. {PRECIO_PLAN_DESTACADO}, sin permanencia.
          </p>
        </div>
        <form action={iniciarPagoDestacado}>
          <input type="hidden" name="negocio_id" value={negocioId} />
          <input type="hidden" name="slug_negocio" value={slugNegocio} />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full bg-terracota-500 px-5 text-base font-semibold text-white hover:bg-terracota-600 transition-colors"
          >
            <Star size={18} aria-hidden="true" />
            Hazte Destacado ({PRECIO_PLAN_DESTACADO})
          </button>
        </form>
      </div>
    </section>
  );
}
