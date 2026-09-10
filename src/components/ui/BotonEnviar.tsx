"use client";

import { useFormStatus } from "react-dom";
import Spinner from "@/components/ui/Spinner";

interface Props {
  children: React.ReactNode;
  /** Texto mientras se envía el formulario. */
  textoEnviando?: string;
  className?: string;
}

// Botón de envío con spinner. `useFormStatus` lee el estado del <form>
// padre, así que la página puede seguir siendo un Server Component.
export default function BotonEnviar({
  children,
  textoEnviando = "Enviando…",
  className = "",
}: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex items-center justify-center gap-2 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed ${className}`}
    >
      {pending && (
        <Spinner size={16} grosor={3} etiqueta={null} className="text-white" />
      )}
      {pending ? textoEnviando : children}
    </button>
  );
}
