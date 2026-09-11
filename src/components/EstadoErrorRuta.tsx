"use client";

import { CloudOff } from "lucide-react";
import EstadoVacio from "@/components/home/EstadoVacio";

interface Props {
  mensaje: string;
  retry: () => void;
  maxWidth?: string;
}

// Contenido compartido de los error.tsx de cada ruta: reutiliza
// EstadoVacio.tsx (mismo estilo oliva/tierra, sin spinner genérico) y
// añade un botón para reintentar. Cada error.tsx sigue necesitando su
// propio "use client" — es requisito de Next para los error boundaries —
// pero delega aquí el contenido para no repetirlo cinco veces.
export default function EstadoErrorRuta({
  mensaje,
  retry,
  maxWidth = "max-w-6xl",
}: Props) {
  return (
    <main className={`mx-auto ${maxWidth} px-6 py-16`}>
      <EstadoVacio icono={CloudOff} mensaje={mensaje} />
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-terracota-600 px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
