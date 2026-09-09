import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Store, Ticket } from "lucide-react";
import Header from "@/components/layout/Header";
import ImagenEvento from "@/components/home/ImagenEvento";
import { createClient } from "@/lib/supabase/server";
import { fechaEvento } from "@/lib/eventos";
import type { Categoria } from "@/types";

interface EventoFichaRow {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  es_todo_el_dia: boolean;
  es_gratis: boolean;
  precio_texto: string | null;
  imagen: string | null;
  lugar_nombre: string | null;
  direccion: string | null;
  categoria: { nombre: string; slug: string; tipo: Categoria["tipo"] } | null;
  negocio: { nombre: string; slug: string } | null;
}

// cache() deduplica la consulta entre generateMetadata y el propio Page,
// que en Next se ejecutan por separado para la misma petición. Mismo
// patrón que negocio/[slug]/page.tsx.
//
// Aquí NO se filtra por fecha, a diferencia de los listados: una ficha
// tiene que seguir abriéndose el día después del evento. Si un enlace
// compartido por WhatsApp devolviera 404 en cuanto el evento termina,
// el compartido no serviría de nada. Lo que sí se filtra es el estado:
// un borrador no debe ser accesible por URL.
const getEvento = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .select(
      "id, slug, titulo, descripcion, fecha_inicio, fecha_fin, es_todo_el_dia, es_gratis, precio_texto, imagen, lugar_nombre, direccion, categoria:categorias(nombre, slug, tipo), negocio:negocios(nombre, slug)"
    )
    .eq("slug", slug)
    .eq("estado", "publicado")
    .maybeSingle()
    .returns<EventoFichaRow>();

  if (error || !data) return null;
  return data;
});

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) return {};

  const cuando = fechaEvento(evento.fecha_inicio, evento.es_todo_el_dia);
  const lugar = evento.lugar_nombre ?? evento.negocio?.nombre;
  const descripcion =
    evento.descripcion ?? [cuando, lugar].filter(Boolean).join(" · ");

  return {
    title: `${evento.titulo} · Jaén Guía`,
    description: descripcion,
    // openGraph es lo que leen WhatsApp, Telegram y las redes para armar
    // la tarjeta del enlace. Las rutas relativas se resuelven contra el
    // metadataBase de layout.tsx.
    openGraph: {
      title: evento.titulo,
      description: descripcion,
      type: "article",
      images: evento.imagen ? [{ url: evento.imagen }] : undefined,
    },
  };
}

export default async function EventoPage({ params }: PageProps) {
  const { slug } = await params;
  const evento = await getEvento(slug);
  if (!evento) notFound();

  const lugar = evento.lugar_nombre ?? evento.negocio?.nombre ?? null;
  const cuando = fechaEvento(evento.fecha_inicio, evento.es_todo_el_dia);
  // La fecha de fin solo aporta si el evento dura más de un día; si no,
  // repetir el mismo día dos veces es ruido.
  const cuandoFin =
    evento.fecha_fin &&
    evento.fecha_fin.slice(0, 10) !== evento.fecha_inicio.slice(0, 10)
      ? fechaEvento(evento.fecha_fin, evento.es_todo_el_dia)
      : null;

  return (
    <>
      <Header />
      <main>
        <div className="relative h-64 w-full overflow-hidden md:h-80">
          <ImagenEvento
            imagen={evento.imagen}
            titulo={evento.titulo}
            fechaInicio={evento.fecha_inicio}
            categoriaTipo={evento.categoria?.tipo ?? null}
            tamano="ficha"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-oliva-900/80 via-oliva-900/20 to-transparent" />

          <div className="relative mx-auto flex h-full max-w-3xl items-end px-6 pb-8 text-white">
            <div>
              {evento.categoria && (
                <Link
                  href={`/eventos?categoria=${evento.categoria.slug}`}
                  className="text-xs font-medium uppercase tracking-wide text-tierra-100 hover:text-white"
                >
                  {evento.categoria.nombre}
                </Link>
              )}
              <h1 className="font-display text-3xl font-semibold md:text-4xl">
                {evento.titulo}
              </h1>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-6 py-8">
          <dl className="space-y-3">
            <div className="flex items-start gap-2">
              <dt className="sr-only">Fecha</dt>
              <CalendarDays size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-oliva-400" />
              <dd className="text-oliva-900">
                {cuando}
                {cuandoFin && <> &ndash; {cuandoFin}</>}
              </dd>
            </div>

            {lugar && (
              <div className="flex items-start gap-2">
                <dt className="sr-only">Lugar</dt>
                <MapPin size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-oliva-400" />
                <dd className="text-oliva-900">
                  {lugar}
                  {evento.direccion && (
                    <span className="block text-sm text-oliva-700">
                      {evento.direccion}
                    </span>
                  )}
                </dd>
              </div>
            )}

            {(evento.es_gratis || evento.precio_texto) && (
              <div className="flex items-start gap-2">
                <dt className="sr-only">Precio</dt>
                <Ticket size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-oliva-400" />
                <dd>
                  {evento.es_gratis ? (
                    <span className="rounded-full bg-terracota-500 px-2 py-1 text-xs font-semibold text-white">
                      Gratis
                    </span>
                  ) : (
                    <span className="text-oliva-900">{evento.precio_texto}</span>
                  )}
                </dd>
              </div>
            )}

            {evento.negocio && (
              <div className="flex items-start gap-2">
                <dt className="sr-only">Organiza</dt>
                <Store size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-oliva-400" />
                <dd className="text-oliva-900">
                  Organiza{" "}
                  <Link
                    href={`/negocio/${evento.negocio.slug}`}
                    className="font-medium text-terracota-600 hover:underline"
                  >
                    {evento.negocio.nombre}
                  </Link>
                </dd>
              </div>
            )}
          </dl>

          {evento.descripcion && (
            <p className="mt-6 whitespace-pre-line text-oliva-700">
              {evento.descripcion}
            </p>
          )}

          <Link
            href="/eventos"
            className="mt-8 inline-block text-sm font-medium text-terracota-600 hover:underline"
          >
            &lsaquo; Todos los eventos
          </Link>
        </div>
      </main>
    </>
  );
}
