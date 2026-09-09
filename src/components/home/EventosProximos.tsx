import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AnimatedSection from "@/components/motion/AnimatedSection";
import GridStagger from "@/components/motion/GridStagger";
import EventoCard, { type EventoTarjeta } from "./EventoCard";
import { filtroEventosVigentes, rangoTemporal } from "@/lib/eventos";
import type { Categoria } from "@/types";

// Dos filas completas de la rejilla de 3 columnas.
const MAX_EVENTOS = 6;

interface EventoRow {
  id: string;
  slug: string;
  titulo: string;
  fecha_inicio: string;
  es_todo_el_dia: boolean;
  es_gratis: boolean;
  imagen: string | null;
  lugar_nombre: string | null;
  categoria: { nombre: string; tipo: Categoria["tipo"] } | null;
  negocio: { nombre: string } | null;
}

async function getEventosProximos(): Promise<EventoTarjeta[]> {
  const supabase = await createClient();

  // Solo 'publicado': los borradores ya los esconde la RLS, pero
  // 'cancelado' y 'aplazado' sí son públicos y no pintan nada en una
  // lista de "próximos" sin una etiqueta que explique su estado.
  //
  const { data, error } = await supabase
    .from("eventos")
    .select(
      "id, slug, titulo, fecha_inicio, es_todo_el_dia, es_gratis, imagen, lugar_nombre, categoria:categorias(nombre, tipo), negocio:negocios(nombre)"
    )
    .eq("estado", "publicado")
    .or(filtroEventosVigentes())
    .order("fecha_inicio", { ascending: true })
    .limit(MAX_EVENTOS)
    .returns<EventoRow[]>();

  if (error || !data) return [];

  return data.map((evento) => ({
    id: evento.id,
    slug: evento.slug,
    titulo: evento.titulo,
    fecha_inicio: evento.fecha_inicio,
    es_todo_el_dia: evento.es_todo_el_dia,
    es_gratis: evento.es_gratis,
    imagen: evento.imagen,
    // Los eventos de agenda oficial traen lugar_nombre; los que publica
    // un negocio desde su panel normalmente no, y ahí el lugar es el
    // propio negocio.
    lugar: evento.lugar_nombre ?? evento.negocio?.nombre ?? null,
    categoriaNombre: evento.categoria?.nombre ?? null,
    categoriaTipo: evento.categoria?.tipo ?? null,
  }));
}

export default async function EventosProximos() {
  const eventos = await getEventosProximos();

  // Si algo de lo que se está mostrando empieza hoy, el titular lo dice:
  // es la pregunta con la que entra el usuario. No cuesta una consulta
  // extra, sale de los eventos ya traídos.
  const finDeHoy = rangoTemporal("hoy").hasta;
  const hayAlgoHoy = eventos.some((evento) => evento.fecha_inicio < finDeHoy);

  return (
    // -mt-10 monta el arranque de esta banda sobre el borde inferior del
    // bento grid de Destacados; el pt-4 (menor que el -mt-10) deja que el
    // propio título "Eventos Próximos" suba y quede solapado con ese
    // borde, no solo el fondo oscuro. Destacados lleva z-10 para quedar
    // visualmente por delante en la zona de solape.
    <AnimatedSection className="-mt-10 bg-oliva-900 pt-4 pb-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold text-tierra-50">
            {hayAlgoHoy ? "Hoy en Jaén" : "Eventos Próximos"}
          </h2>
          {eventos.length > 0 && (
            <Link
              href={hayAlgoHoy ? "/eventos?cuando=hoy" : "/eventos"}
              className="text-sm font-medium text-terracota-400 hover:underline"
            >
              Ver todos &rsaquo;
            </Link>
          )}
        </div>

        {eventos.length === 0 ? (
          // Sin caja punteada de EstadoVacio: sobre la banda oscura un
          // recuadro vacío pesa más que lo que hay dentro. Un mensaje
          // corto y una llamada a publicar ocupan menos y dicen más.
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CalendarDays size={26} aria-hidden="true" className="text-oliva-400" />
            <p className="text-tierra-100">
              Todavía no hay eventos programados en Jaén.
            </p>
            <Link
              href="/panel"
              className="text-sm font-semibold text-terracota-400 hover:underline"
            >
              ¿Tienes un negocio? Publica el tuyo &rsaquo;
            </Link>
          </div>
        ) : (
          // Misma retícula que Destacados (max-w-6xl, px-6, gap-4 y 3
          // columnas en escritorio), con un escalón intermedio de 2
          // columnas en tablet.
          <GridStagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {eventos.map((evento, i) => (
              <EventoCard key={evento.id} evento={evento} index={i} />
            ))}
          </GridStagger>
        )}
      </div>
    </AnimatedSection>
  );
}
