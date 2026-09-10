import Spinner from "@/components/ui/Spinner";

interface Props {
  texto?: string;
  /** Por defecto crece para ocupar el hueco entre cabecera y pie. */
  className?: string;
}

// Pantalla de carga para los `loading.tsx` de rutas sin esqueleto propio.
export default function PantallaCarga({
  texto = "Cargando…",
  className = "flex-1 min-h-[60vh]",
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 px-6 ${className}`}
    >
      <Spinner size={40} etiqueta={texto} />
      <p className="text-sm font-bold uppercase tracking-wide text-terracota-600">
        {texto}
      </p>
    </div>
  );
}
