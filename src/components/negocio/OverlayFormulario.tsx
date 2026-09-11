"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export default function OverlayFormulario({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <>
      {children}
      {pending && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[2rem] bg-oliva-900/10 backdrop-blur-[2px]">
          <div className="rounded-full bg-white p-3 shadow-lg">
            <Loader2 size={32} className="animate-spin text-terracota-600" />
          </div>
        </div>
      )}
    </>
  );
}
