import { Sparkles } from "lucide-react";
import { iniciarPagoEventoPromocionado } from "@/lib/actions/pagos";
import { PRECIO_EVENTO_PROMOCIONADO } from "@/lib/stripe";

interface Props {
  eventoId: string;
  slugNegocio: string;
}

// Botón de pago único: abre Stripe Checkout. El evento pasa a
// promocionado cuando llega el webhook, no al volver del pago.
export default function PromocionarEvento({ eventoId, slugNegocio }: Props) {
  return (
    <form action={iniciarPagoEventoPromocionado}>
      <input type="hidden" name="evento_id" value={eventoId} />
      <input type="hidden" name="slug_negocio" value={slugNegocio} />
      <button
        type="submit"
        className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-terracota-500 px-4 text-base font-semibold text-terracota-600 hover:bg-terracota-500 hover:text-white transition-colors"
      >
        <Sparkles size={16} aria-hidden="true" />
        Promocionar ({PRECIO_EVENTO_PROMOCIONADO})
      </button>
    </form>
  );
}
