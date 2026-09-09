import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import Header from "@/components/layout/Header";
import EventoCard, { type EventoTarjeta } from "@/components/home/EventoCard";
import GridStagger from "@/components/motion/GridStagger";
import { createClient } from "@/lib/supabase/server";
import { getCategorias } from "@/lib/categorias";
import { filtroEventosVigentes } from "@/lib/eventos";
import type { Categoria } from "@/types";

const TITULO = "Eventos en Jaén";
const DESCRIPCION =
  "Conciertos, ferias, rutas y talleres de la provincia, ordenados por fecha.";

export const metadata: Metadata = {
  title: `${TITULO} · Jaén Guía`,
  description: DESCRIPCION,
};

interface EventoRow {
  id: string;
  slug: string;
  titulo: string;
  fecha_inicio: string;
  es_todo_el_dia: boolean;
  es_gratis: boolean;
  imagen: string | null;
  lugar_nombre: string | null;
  categoria: { nombre: string; slug: string; tipo: Categoria["tipo"] } | null;
  negocio: { nombre: string } | null;
}

// Como en /destacados, sin paginar: la agenda de una provincia no da
// para listados de cientos de filas. Si algún día los da, este es el
// sitio donde meter el rango, igual que en [categoria]/page.tsx.
async function getEventos(categoriaSlug?: string): Promise<EventoTarjeta[]> {
  const supabase = await createClient();

  // El !inner solo cuando se filtra: hace falta para poder filtrar por un
  // campo de la tabla relacionada, pero como INNER JOIN descarta los
  // eventos sin categoria_id. Sin filtro se usa el join normal para que
  // esos eventos sigan listándose, igual que hace la home.
  const relacion = categoriaSlug ? "categorias!inner" : "categorias";
  let consulta = supabase
    .from("eventos")
    .select(
      `id, slug, titulo, fecha_inicio, es_todo_el_dia, es_gratis, imagen, lugar_nombre, categoria:${relacion}(nombre, slug, tipo), negocio:negocios(nombre)`
    )
    .eq("estado", "publicado")
    .or(filtroEventosVigentes());

  if (categoriaSlug) consulta = consulta.eq("categoria.slug", categoriaSlug);

  const { data, error } = await consulta
    .order("fecha_inicio", { ascending: true })
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
    lugar: evento.lugar_nombre ?? evento.negocio?.nombre ?? null,
    categoriaNombre: evento.categoria?.nombre ?? null,
    categoriaTipo: evento.categoria?.tipo ?? null,
  }));
}

interface PageProps {
  searchParams: Promise<{ categoria?: string }>;
}

export default async function EventosPage({ searchParams }: PageProps) {
  const { categoria } = await searchParams;
  const [categorias, eventos] = await Promise.all([
    getCategorias(),
    getEventos(categoria),
  ]);

  const hrefCategoria = (slug?: string) =>
    slug ? `/eventos?categoria=${slug}` : "/eventos";

  const claseChip = (activo: boolean) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      activo
        ? "bg-oliva-600 text-white"
        : "border border-oliva-100 text-oliva-700 hover:bg-oliva-100"
    }`;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 max-w-2xl">
          <h1 className="font-display text-3xl font-semibold text-oliva-900">
            {TITULO}
          </h1>
          <p className="mt-2 text-oliva-700">{DESCRIPCION}</p>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-medium text-oliva-700">
            Categoría:
          </span>
          <Link href={hrefCategoria()} className={claseChip(!categoria)}>
            Todas
          </Link>
          {categorias.map((c) => (
            <Link
              key={c.slug}
              href={hrefCategoria(c.slug)}
              className={claseChip(categoria === c.slug)}
            >
              {c.nombre}
            </Link>
          ))}
        </div>

        {eventos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-oliva-100 bg-tierra-50 px-6 py-12 text-center">
            <CalendarDays size={28} aria-hidden="true" className="text-oliva-400" />
            <p className="font-display text-base text-oliva-700">
              {categoria
                ? "No hay eventos programados en esta categoría"
                : "Todavía no hay eventos programados en Jaén"}
            </p>
            {categoria && (
              <Link
                href="/eventos"
                className="text-sm font-semibold text-terracota-600 hover:underline"
              >
                Ver todas las categorías &rsaquo;
              </Link>
            )}
          </div>
        ) : (
          <GridStagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {eventos.map((evento, i) => (
              <EventoCard key={evento.id} evento={evento} index={i} />
            ))}
          </GridStagger>
        )}
      </main>
    </>
  );
}
