"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export default function BotonSubmitResena({ texto = "Publicar reseña" }: { texto?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`relative inline-flex min-h-[52px] items-center justify-center rounded-full px-8 py-3.5 font-bold text-white transition-all overflow-hidden ${
        pending
          ? "bg-oliva-500 cursor-not-allowed"
          : "bg-oliva-900 hover:bg-terracota-700 hover:scale-[1.02] active:scale-[0.98]"
      }`}
    >
      <span className={`flex items-center justify-center gap-2 ${pending ? "opacity-0" : ""}`}>
        {texto}
      </span>
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Loader2 size={24} className="animate-spin text-white" />
        </span>
      )}
    </button>
  );
}

