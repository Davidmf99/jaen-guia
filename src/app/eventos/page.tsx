import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import EventoCard, { type EventoTarjeta } from "@/components/home/EventoCard";
import GridStagger from "@/components/motion/GridStagger";
import { createClient } from "@/lib/supabase/server";
import { getCategorias } from "@/lib/categorias";
import { getMunicipioCapitalId } from "@/lib/municipios";
import {
  creditoFuente,
  etiquetaFecha,
  filtroEventosEnRango,
  filtroEventosVigentes,
  rangoTemporal,
  type CorteTemporal,
} from "@/lib/eventos";
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
  fecha_fin: string | null;
  es_todo_el_dia: boolean;
  es_gratis: boolean;
  imagen: string | null;
  lugar_nombre: string | null;
  origen: string;
  fuente_nombre: string | null;
  fuente_url: string | null;
  categoria: { nombre: string; slug: string; tipo: Categoria["tipo"] } | null;
  negocio: { nombre: string } | null;
}

// Como en /destacados, sin paginar: la agenda de una provincia no da
// para listados de cientos de filas. Si algún día los da, este es el
// sitio donde meter el rango, igual que en [categoria]/page.tsx.
const CORTES: { valor: CorteTemporal | ""; etiqueta: string }[] = [
  { valor: "", etiqueta: "Todos" },
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "manana", etiqueta: "Mañana" },
  { valor: "finde", etiqueta: "Este finde" },
];

async function getEventos(
  categoriaSlug?: string,
  corte?: CorteTemporal
): Promise<EventoTarjeta[]> {
  const supabase = await createClient();
  const capitalId = await getMunicipioCapitalId();

  // El !inner solo cuando se filtra: hace falta para poder filtrar por un
  // campo de la tabla relacionada, pero como INNER JOIN descarta los
  // eventos sin categoria_id. Sin filtro se usa el join normal para que
  // esos eventos sigan listándose, igual que hace la home.
  const relacion = categoriaSlug ? "categorias!inner" : "categorias";
  let consulta = supabase
    .from("eventos")
    .select(
      `id, slug, titulo, fecha_inicio, fecha_fin, es_todo_el_dia, es_gratis, imagen, lugar_nombre, origen, fuente_nombre, fuente_url, categoria:${relacion}(nombre, slug, tipo), negocio:negocios(nombre)`
    )
    .eq("estado", "publicado");

  // Fase capital: ver el comentario en EventosProximos.tsx. Lo de la
  // provincia sigue en la tabla, esperando a que se abra esa fase.
  consulta = consulta.eq("municipio_id", capitalId);

  if (corte) {
    // Un corte es un subconjunto de los vigentes, no una ventana al
    // pasado: rangoTemporal() nunca devuelve un `desde` anterior a ahora,
    // así que este filtro ya implica el de vigencia.
    const { desde, hasta } = rangoTemporal(corte);
    consulta = consulta.lt("fecha_inicio", hasta).or(filtroEventosEnRango(desde));
  } else {
    consulta = consulta.or(filtroEventosVigentes());
  }

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
    fechaTexto: etiquetaFecha(
      evento.fecha_inicio,
      evento.fecha_fin,
      evento.es_todo_el_dia
    ),
    es_todo_el_dia: evento.es_todo_el_dia,
    es_gratis: evento.es_gratis,
    imagen: evento.imagen,
    lugar: evento.lugar_nombre ?? evento.negocio?.nombre ?? null,
    organizador:
      evento.origen === "negocio" ? evento.negocio?.nombre ?? null : null,
    fuente: creditoFuente(evento.fuente_nombre, evento.fuente_url),
    categoriaNombre: evento.categoria?.nombre ?? null,
    categoriaTipo: evento.categoria?.tipo ?? null,
  }));
}

interface PageProps {
  searchParams: Promise<{ categoria?: string; cuando?: string }>;
}

export default async function EventosPage({ searchParams }: PageProps) {
  const { categoria, cuando } = await searchParams;
  const corte: CorteTemporal | undefined =
    cuando === "hoy" || cuando === "manana" || cuando === "finde"
      ? cuando
      : undefined;

  const [categorias, eventos] = await Promise.all([
    getCategorias(),
    getEventos(categoria, corte),
  ]);

  // Los dos filtros se combinan, así que cada enlace conserva el otro.
  const href = (cambios: { categoria?: string; cuando?: string }) => {
    const params = new URLSearchParams();
    const nuevaCategoria =
      "categoria" in cambios ? cambios.categoria : categoria;
    const nuevoCuando = "cuando" in cambios ? cambios.cuando : corte;
    if (nuevaCategoria) params.set("categoria", nuevaCategoria);
    if (nuevoCuando) params.set("cuando", nuevoCuando);
    const query = params.toString();
    return query ? `/eventos?${query}` : "/eventos";
  };

  const claseChip = (activo: boolean) =>
    `inline-flex min-h-11 items-center rounded-full px-4 text-base font-medium transition-colors ${
      activo
        ? "bg-oliva-600 text-white"
        : "border border-oliva-100 text-oliva-700 hover:bg-oliva-100"
    }`;

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8 max-w-2xl">
          <h1 className="font-display text-3xl font-semibold text-oliva-900">
            {TITULO}
          </h1>
          <p className="mt-2 text-oliva-700">{DESCRIPCION}</p>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-base font-medium text-oliva-700">
            Cuándo:
          </span>
          {CORTES.map((c) => (
            <Link
              key={c.valor || "todos"}
              href={href({ cuando: c.valor || undefined })}
              className={claseChip((corte ?? "") === c.valor)}
            >
              {c.etiqueta}
            </Link>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-base font-medium text-oliva-700">
            Categoría:
          </span>
          <Link href={href({ categoria: undefined })} className={claseChip(!categoria)}>
            Todas
          </Link>
          {categorias.map((c) => (
            <Link
              key={c.slug}
              href={href({ categoria: c.slug })}
              className={claseChip(categoria === c.slug)}
            >
              {c.nombre}
            </Link>
          ))}
        </div>

        {eventos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-oliva-100 bg-tierra-50 px-6 py-12 text-center">
            <CalendarDays size={28} aria-hidden="true" className="text-oliva-500" />
            <p className="font-display text-lg text-oliva-700">
              {corte === "hoy"
                ? "Hoy no hay nada programado en Jaén"
                : corte === "finde"
                  ? "Este fin de semana no hay nada programado"
                  : categoria
                    ? "No hay eventos programados en esta categoría"
                    : "Todavía no hay eventos programados en Jaén"}
            </p>
            {(categoria || corte) && (
              <Link
                href="/eventos"
                className="text-base font-semibold text-terracota-600 hover:underline"
              >
                Ver todos los eventos &rsaquo;
              </Link>
            )}
          </div>
        ) : (
          <GridStagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {eventos.map((evento) => (
              <EventoCard key={evento.id} evento={evento} />
            ))}
          </GridStagger>
        )}
      </main>
    </>
  );
}
