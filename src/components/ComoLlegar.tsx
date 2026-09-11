import { Navigation } from "lucide-react";

interface Props {
  /** Nombre del sitio; se usa si no hay dirección ni coordenadas. */
  nombre: string;
  direccion?: string | null;
  lat?: number | null;
  lng?: number | null;
  variante?: "principal" | "discreta";
}

// Enlace a la aplicación de mapas del teléfono.
//
// Hace falta porque en táctil el mapa de Leaflet tiene el arrastre
// desactivado a propósito (si no, se traga el scroll de la página), así
// que es una imagen fija con dos botones de zoom. La dirección estaba
// como texto plano y no había ninguna forma de decir "llévame ahí", que
// es justo la acción siguiente de quien ya ha decidido el plan.
//
// Se usa la URL universal de Google Maps: en Android e iOS el sistema la
// abre en la app de mapas que tenga puesta, y en escritorio en el
// navegador. Con coordenadas cuando las hay —es lo único inequívoco— y
// con el texto de la dirección si no.
export default function ComoLlegar({
  nombre,
  direccion,
  lat,
  lng,
  variante = "principal",
}: Props) {
  const destino =
    lat != null && lng != null
      ? `${lat},${lng}`
      : [nombre, direccion].filter(Boolean).join(", ");

  if (!destino) return null;

  const href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;

  const clase =
    variante === "principal"
      ? "bg-oliva-900 text-white hover:bg-terracota-700"
      : "border border-oliva-600 text-oliva-700 hover:bg-oliva-600 hover:text-white";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-base font-semibold transition-colors ${clase}`}
    >
      <Navigation size={18} aria-hidden="true" className="shrink-0" />
      Cómo llegar
      <span className="sr-only"> a {nombre} (se abre en Google Maps)</span>
    </a>
  );
}
