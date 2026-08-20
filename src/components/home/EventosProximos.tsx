import { createClient } from "@/lib/supabase/server";
import EstadoVacio from "./EstadoVacio";
import AnimatedSection from "@/components/motion/AnimatedSection";
import type { Evento } from "@/types";

// Antes terminaban en "to-oliva-900": sobre el fondo oscuro de la
// sección (ahora oliva-900) esos degradados se fundían con el fondo y
// las tarjetas perdían el borde visual. Se sustituyen los extremos
// oscuros por terracota/oliva-700 para que sigan destacando.
const DEGRADADOS_EVENTO = [
  "from-oliva-600 to-terracota-600",
  "from-terracota-500 to-oliva-700",
  "from-oliva-400 to-terracota-600",
  "from-terracota-400 to-oliva-700",
];

const MESES = [
  "ene.", "feb.", "mar.", "abr.", "may.", "jun.",
  "jul.", "ago.", "sept.", "oct.", "nov.", "dic.",
];

function formatFecha(fechaIso: string) {
  const fecha = new Date(fechaIso);
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

async function getEventosProximos() {
  const supabase = await createClient();
  const hoy = new Date().toISOString();

  const { data, error } = await supabase
    .from("eventos")
    .select("titulo, fecha_inicio")
    .gte("fecha_inicio", hoy)
    .order("fecha_inicio", { ascending: true })
    .limit(6)
    .returns<Pick<Evento, "titulo" | "fecha_inicio">[]>();

  if (error || !data) return [];

  return data;
}

export default async function EventosProximos() {
  const eventos = await getEventosProximos();

  return (
    // -mt-10 monta el arranque de esta banda sobre el borde inferior del
    // bento grid de Destacados; el pt-4 (menor que el -mt-10) deja que el
    // propio título "Eventos Próximos" suba y quede solapado con ese
    // borde, no solo el fondo oscuro. Destacados lleva z-10 para quedar
    // visualmente por delante en la zona de solape.
    <AnimatedSection className="-mt-10 bg-oliva-900 pt-4 pb-10">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="mb-5 font-display text-2xl font-semibold text-tierra-50">
          Eventos Próximos
        </h2>

        {eventos.length === 0 ? (
          <EstadoVacio mensaje="Aún no hay eventos próximos programados" />
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {eventos.map((evento, i) => (
              <article
                key={evento.titulo}
                className="min-w-[220px] flex-1 overflow-hidden rounded-2xl bg-oliva-700 text-white"
              >
                <div
                  className={`h-32 bg-gradient-to-br ${DEGRADADOS_EVENTO[i % DEGRADADOS_EVENTO.length]}`}
                />
                <div className="p-4">
                  <p className="text-xs text-tierra-200">
                    {formatFecha(evento.fecha_inicio)}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold leading-snug text-tierra-50">
                    {evento.titulo}
                  </h3>
                  <button className="mt-3 rounded-full bg-terracota-500 px-3 py-1 text-xs font-semibold hover:bg-terracota-600 transition-colors">
                    Más info
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
