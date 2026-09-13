"use client";

import { useState } from "react";
import { XCircle, RotateCcw } from "lucide-react";
import { cancelarSuscripcion, reanudarSuscripcion } from "@/lib/actions/suscripcion";

interface Props {
  slugNegocio: string;
  cancelaAlFinal: boolean;
  /** Texto tipo "12 de octubre" para el aviso. */
  finPeriodo: string | null;
}

// Cancelación en dos pasos, en la propia página (igual que BorrarEvento):
// el primer clic solo enseña la confirmación. Sin JavaScript, el botón
// envía directo y cancela.
export default function CancelarSuscripcion({ slugNegocio, cancelaAlFinal, finPeriodo }: Props) {
  const [confirmando, setConfirmando] = useState(false);

  if (cancelaAlFinal) {
    return (
      <form action={reanudarSuscripcion}>
        <input type="hidden" name="slug_negocio" value={slugNegocio} />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-oliva-900 px-5 text-base font-semibold text-white hover:bg-oliva-700 transition-colors"
        >
          <RotateCcw size={18} aria-hidden="true" />
          Reanudar suscripción
        </button>
      </form>
    );
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-oliva-200 px-5 text-base font-semibold text-oliva-700 hover:border-terracota-600 hover:text-terracota-600 transition-colors"
      >
        <XCircle size={18} aria-hidden="true" />
        Cancelar suscripción
      </button>
    );
  }

  return (
    <form action={cancelarSuscripcion} className="rounded-2xl border border-terracota-500/40 bg-terracota-500/5 p-4">
      <input type="hidden" name="slug_negocio" value={slugNegocio} />
      <p className="text-base text-oliva-900">
        Tu negocio seguirá Destacado{finPeriodo ? ` hasta el ${finPeriodo}` : " hasta el final del periodo pagado"} y
        después volverá al plan gratuito. No se cobra nada más. ¿Seguro?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-full bg-terracota-500 px-5 text-base font-semibold text-white hover:bg-terracota-600 transition-colors"
        >
          Sí, cancelar
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="inline-flex min-h-11 items-center rounded-full border border-oliva-200 px-5 text-base font-semibold text-oliva-900 hover:border-oliva-900 transition-colors"
        >
          No, seguir
        </button>
      </div>
    </form>
  );
}
