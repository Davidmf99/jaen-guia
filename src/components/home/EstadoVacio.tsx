import type { LucideIcon } from "lucide-react";
import { Sprout } from "lucide-react";

interface Props {
  mensaje: string;
  icono?: LucideIcon;
}

// Estado vacío reutilizable para secciones de la home que dependen de
// datos de Supabase (negocios, eventos...) cuando la tabla aún no tiene
// filas que mostrar. Mantiene la identidad visual (bordes redondeados,
// tonos tierra/oliva) en vez de dejar la sección en blanco o rota.
export default function EstadoVacio({ mensaje, icono: Icono = Sprout }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-oliva-100 bg-tierra-50 px-6 py-12 text-center">
      <Icono size={28} className="text-oliva-400" />
      <p className="font-display text-base text-oliva-700">{mensaje}</p>
    </div>
  );
}
