interface Props {
  /** Diámetro en píxeles. */
  size?: number;
  /** Grosor del trazo. */
  grosor?: number;
  className?: string;
  /** Texto para lectores de pantalla. `null` si el contexto ya lo explica. */
  etiqueta?: string | null;
}

// Spinner en terracota (el naranja de la paleta). No lleva "use client":
// es solo SVG + animación CSS, así que funciona igual en Server Components.
export default function Spinner({
  size = 24,
  grosor = 3,
  className = "",
  etiqueta = "Cargando",
}: Props) {
  return (
    <span
      role={etiqueta ? "status" : undefined}
      aria-live={etiqueta ? "polite" : undefined}
      className={`inline-flex items-center justify-center ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="animate-spin"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth={grosor}
          className="text-terracota-500/20"
        />
        <path
          d="M22 12a10 10 0 0 0-10-10"
          stroke="currentColor"
          strokeWidth={grosor}
          strokeLinecap="round"
          className="text-terracota-500"
        />
      </svg>
      {etiqueta && <span className="sr-only">{etiqueta}</span>}
    </span>
  );
}
