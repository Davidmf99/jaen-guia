import Link from "next/link";
import { Trash2 } from "lucide-react";
import FormularioEvento from "./FormularioEvento";
import { borrarEventoNegocio } from "@/lib/actions/eventos";
import { fechaEvento } from "@/lib/eventos";

export interface EventoPanel {
  id: string;
  slug: string;
  titulo: string;
  fecha_inicio: string;
  es_todo_el_dia: boolean;
  lugar_nombre: string | null;
}

interface Props {
  negocio: {
    id: string;
    slug: string;
    nombre: string;
    direccion: string | null;
    categoria_id: string | null;
  };
  categorias: { id: string; nombre: string }[];
  eventos: EventoPanel[];
}

export default function EventosNegocio({ negocio, categorias, eventos }: Props) {
  return (
    <section id="eventos" className="mt-10 scroll-mt-24">
      <header className="mb-4">
        <h2 className="font-display text-2xl font-semibold text-oliva-900">
          Tus eventos
        </h2>
        <p className="mt-1 text-sm text-oliva-700">
          Lo que pasa hoy o esta semana en tu local: música en directo, tapa del
          día, catas, partidos. Se publica al instante y sale en la portada de
          Jaén Guía.
        </p>
      </header>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <FormularioEvento
          negocioId={negocio.id}
          slugNegocio={negocio.slug}
          nombreNegocio={negocio.nombre}
          direccionNegocio={negocio.direccion}
          categoriaIdNegocio={negocio.categoria_id}
          categorias={categorias}
        />
      </div>

      <h3 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wide text-terracota-600">
        Publicados ({eventos.length})
      </h3>

      {eventos.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-oliva-700 shadow-sm">
          Todavía no has publicado ningún evento.
        </p>
      ) : (
        <ul className="space-y-2">
          {eventos.map((evento) => (
            <li
              key={evento.id}
              className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-terracota-600">
                  {fechaEvento(evento.fecha_inicio, evento.es_todo_el_dia)}
                </p>
                <Link
                  href={`/evento/${evento.slug}`}
                  className="block truncate font-semibold text-oliva-900 hover:text-terracota-600 transition-colors"
                >
                  {evento.titulo}
                </Link>
                {evento.lugar_nombre && (
                  <p className="truncate text-sm text-oliva-600">
                    {evento.lugar_nombre}
                  </p>
                )}
              </div>

              {/* Server Action directa: sin JS también borra. */}
              <form action={borrarEventoNegocio}>
                <input type="hidden" name="evento_id" value={evento.id} />
                <button
                  type="submit"
                  aria-label={`Borrar "${evento.titulo}"`}
                  className="shrink-0 rounded-full p-2 text-oliva-400 hover:bg-terracota-500/10 hover:text-terracota-600 transition-colors"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
