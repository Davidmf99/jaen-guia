import { Heart } from "lucide-react";
import { toggleFavorito } from "@/lib/actions/favoritos";

interface Props {
  negocioId: string;
  esFavorito: boolean;
  rutaActual: string;
  /** La ficha de negocio lo quiere más grande que la tarjeta. */
  tamano?: "tarjeta" | "ficha";
}

// `<form action={...}>` con Server Action, igual que "Cerrar sesión" en
// Header.tsx: funciona sin JS y no hace falta convertir nada en Client
// Component solo para este botón.
//
// Lleva la palabra al lado del corazón a propósito. Un corazón suelto es
// una convención de app que este público no tiene por qué conocer, y el
// aria-label que había solo lo oía quien usa lector de pantalla.
//
// El tamaño también era un problema: eran 26×26 px, pegados a la esquina
// de la foto y encima de un enlace que ocupa toda la tarjeta, así que
// fallar el toque significaba irse a otra página.
export default function BotonFavorito({
  negocioId,
  esFavorito,
  rutaActual,
  tamano = "tarjeta",
}: Props) {
  const ficha = tamano === "ficha";

  return (
    <form action={toggleFavorito}>
      <input type="hidden" name="negocio_id" value={negocioId} />
      <input type="hidden" name="pathname" value={rutaActual} />
      <button
        type="submit"
        aria-pressed={esFavorito}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full bg-white/95 font-semibold text-oliva-900 shadow-sm hover:bg-white transition-colors ${
          ficha ? "px-5 text-base" : "px-3.5 text-sm"
        }`}
      >
        <Heart
          size={ficha ? 22 : 18}
          aria-hidden="true"
          className={
            esFavorito
              ? "shrink-0 fill-terracota-500 text-terracota-500"
              : "shrink-0 text-oliva-700"
          }
        />
        {esFavorito ? "Guardado" : "Guardar"}
      </button>
    </form>
  );
}
