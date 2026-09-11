"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { borrarEventoNegocio } from "@/lib/actions/eventos";

interface Props {
  eventoId: string;
  titulo: string;
}

// Borrado en dos pasos. Antes era una papelera de 16 px dentro de un
// botón de 32×32 que ejecutaba la Server Action directamente: sin texto,
// sin confirmación y sin deshacer. Un dueño de local con dedos grandes
// borraba el evento del viernes queriendo tocar el título.
//
// La confirmación es en la propia fila y no un confirm() del navegador:
// un diálogo del sistema aparece descolgado del sitio y mucha gente lo
// cierra por reflejo sin leerlo.
//
// Sin JavaScript el componente no llega a hidratarse y el botón hace lo
// que hacía antes: enviar el formulario y borrar. Se pierde el paso de
// confirmación, no la función.
export default function BorrarEvento({ eventoId, titulo }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const abrirRef = useRef<HTMLButtonElement>(null);

  // Al abrir la confirmación el foco va a "Cancelar": es la salida
  // segura, y quien navega con teclado no se queda en el sitio anterior.
  useEffect(() => {
    if (confirmando) cancelarRef.current?.focus();
  }, [confirmando]);

  if (!confirmando) {
    return (
      <button
        ref={abrirRef}
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-base font-medium text-oliva-700 hover:bg-terracota-600/10 hover:text-terracota-600 transition-colors"
      >
        <Trash2 size={18} aria-hidden="true" />
        <span>
          Borrar<span className="sr-only"> «{titulo}»</span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <span className="text-base font-semibold text-oliva-900">
        ¿Seguro?
      </span>
      <form action={borrarEventoNegocio}>
        <input type="hidden" name="evento_id" value={eventoId} />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-full bg-terracota-600 px-4 text-base font-semibold text-white hover:bg-terracota-700 transition-colors"
        >
          Sí, borrar<span className="sr-only"> «{titulo}»</span>
        </button>
      </form>
      <button
        ref={cancelarRef}
        type="button"
        onClick={() => {
          setConfirmando(false);
          // Devolver el foco al disparador: si no, al cancelar el foco se
          // queda en el body y se pierde el sitio del teclado.
          requestAnimationFrame(() => abrirRef.current?.focus());
        }}
        className="inline-flex min-h-11 items-center rounded-full border border-oliva-100 px-4 text-base font-medium text-oliva-700 hover:bg-oliva-100 transition-colors"
      >
        Cancelar
      </button>
    </div>
  );
}
