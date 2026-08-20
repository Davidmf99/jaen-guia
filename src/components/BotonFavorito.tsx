import { Heart } from "lucide-react";
import { toggleFavorito } from "@/lib/actions/favoritos";

interface Props {
  negocioId: string;
  esFavorito: boolean;
  rutaActual: string;
  size?: number;
  padding?: string;
}

// `<form action={...}>` con Server Action, igual que "Cerrar sesión" en
// Header.tsx: funciona sin JS y no hace falta convertir nada en Client
// Component solo para este botón.
export default function BotonFavorito({
  negocioId,
  esFavorito,
  rutaActual,
  size = 14,
  padding = "p-1.5",
}: Props) {
  return (
    <form action={toggleFavorito}>
      <input type="hidden" name="negocio_id" value={negocioId} />
      <input type="hidden" name="pathname" value={rutaActual} />
      <button
        type="submit"
        aria-label={esFavorito ? "Quitar de favoritos" : "Guardar en favoritos"}
        aria-pressed={esFavorito}
        className={`rounded-full bg-white/90 ${padding} hover:bg-white transition-colors`}
      >
        <Heart
          size={size}
          aria-hidden="true"
          className={
            esFavorito
              ? "fill-terracota-500 text-terracota-500"
              : "text-oliva-700"
          }
        />
      </button>
    </form>
  );
}
