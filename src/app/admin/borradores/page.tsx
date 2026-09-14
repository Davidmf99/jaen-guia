import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, X, ExternalLink } from "lucide-react";
import EstadoVacio from "@/components/home/EstadoVacio";
import { createClient } from "@/lib/supabase/server";
import { resolverBorradorAdmin, quitarEventoRedAdmin } from "@/lib/actions/eventos";
import { horaJaenParaInput, fechaEventoAbsoluta } from "@/lib/eventos";

export const metadata: Metadata = {
  title: "Borradores de redes · Jaén Guía",
  robots: { index: false, follow: false },
};

interface Borrador {
  id: string;
  titulo: string;
  descripcion: string | null;
  imagen: string | null;
  fecha_inicio: string;
  es_todo_el_dia: boolean;
  es_gratis: boolean;
  precio_texto: string | null;
  origen: "whatsapp" | "facebook" | "instagram";
  fuente_url: string | null;
  confianza: "alta" | "media" | "baja" | null;
  created_at: string;
  negocio: { slug: string; nombre: string } | null;
}

interface Publicado {
  id: string;
  titulo: string;
  fecha_inicio: string;
  es_todo_el_dia: boolean;
  origen: "whatsapp" | "facebook" | "instagram";
  fuente_url: string | null;
  fuente_nombre: string | null;
  lugar_nombre: string | null;
  created_at: string;
  negocio: { slug: string; nombre: string } | null;
}

interface SeguimientoRoto {
  negocio_id: string;
  plataforma: string;
  identificador: string | null;
  ultimo_error: string | null;
  negocio: { slug: string; nombre: string } | null;
}

interface PageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

const NOMBRE_ORIGEN = { whatsapp: "WhatsApp", facebook: "Facebook", instagram: "Instagram" } as const;
const PESO_CONFIANZA = { alta: 0, media: 1, baja: 2 } as const;
const CAMPO = "mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2 text-base outline-none focus:border-oliva-400";

// Bandeja para confirmar lo que entra por redes cuando el negocio no
// hace nada (que es lo esperable). Cada tarjeta es un formulario con lo
// que leyó Claude ya rellenado: lo normal es mirar el cartel, comprobar
// la hora y pulsar Publicar. Orden: primero los de confianza baja
// (más probable que haya que corregir), después por fecha del evento.
export default async function BorradoresAdminPage({ searchParams }: PageProps) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?volver=%2Fadmin%2Fborradores");

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "admin") redirect("/");

  // Se enseñan también los de ayer: un cartel leído tarde sigue
  // mereciendo un vistazo antes de descartarlo.
  const desde = new Date(new Date().getTime() - 86400000).toISOString();

  // Lo publicado solo en los últimos 7 días: es lo que aún puede
  // sorprender. Lo de hace un mes ya lo vio alguien.
  const hace7Dias = new Date(new Date().getTime() - 7 * 86400000).toISOString();

  const [{ data: borradores }, { data: rotos }, { data: publicados }] = await Promise.all([
    supabase
      .from("eventos")
      .select(
        "id, titulo, descripcion, imagen, fecha_inicio, es_todo_el_dia, es_gratis, precio_texto, origen, fuente_url, confianza, created_at, negocio:negocios(slug, nombre)"
      )
      .eq("estado", "borrador")
      .in("origen", ["whatsapp", "facebook", "instagram"])
      .gte("fecha_inicio", desde)
      .order("fecha_inicio", { ascending: true })
      .returns<Borrador[]>(),
    supabase
      .from("negocios_seguimiento")
      .select("negocio_id, plataforma, identificador, ultimo_error, negocio:negocios(slug, nombre)")
      .eq("desactivado", true)
      .returns<SeguimientoRoto[]>(),
    supabase
      .from("eventos")
      .select("id, titulo, fecha_inicio, es_todo_el_dia, origen, fuente_url, fuente_nombre, lugar_nombre, created_at, negocio:negocios(slug, nombre)")
      .eq("estado", "publicado")
      .in("origen", ["whatsapp", "facebook", "instagram"])
      .gte("created_at", hace7Dias)
      .order("created_at", { ascending: false })
      .returns<Publicado[]>(),
  ]);

  const lista = [...(borradores ?? [])].sort(
    (a, b) => PESO_CONFIANZA[b.confianza ?? "media"] - PESO_CONFIANZA[a.confianza ?? "media"]
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-oliva-900">Borradores de redes</h1>
        <p className="mt-2 text-oliva-700">
          Lo leído en Instagram, Facebook o WhatsApp se publica solo cuando la lectura es fiable. Aquí queda lo
          dudoso, por si quieres mirarlo, y lo publicado esta semana, por si algo se ha colado.
        </p>
        <p className="mt-1 text-sm text-oliva-600">
          <Link href="/admin/solicitudes" className="hover:underline">
            Solicitudes de negocio ›
          </Link>
        </p>
      </header>

      {(ok || error) && (
        <p
          role="status"
          className={`mb-6 rounded-2xl px-4 py-3 text-base font-semibold ${
            error ? "bg-terracota-500/10 text-terracota-600" : "bg-oliva-100 text-oliva-900"
          }`}
        >
          {error ?? ok}
        </p>
      )}

      <section>
        <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-[0.2em] text-terracota-600">
          Pendientes ({lista.length})
        </h2>
        {lista.length === 0 ? (
          <EstadoVacio mensaje="No hay borradores pendientes." />
        ) : (
          <ul className="space-y-4">
            {lista.map((b) => (
              <li key={b.id} className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-semibold text-oliva-900">
                    {b.negocio ? (
                      <Link href={`/negocio/${b.negocio.slug}`} className="hover:underline">
                        {b.negocio.nombre}
                      </Link>
                    ) : (
                      "Sin negocio"
                    )}
                  </p>
                  <p className="text-sm text-oliva-600">
                    Visto en {NOMBRE_ORIGEN[b.origen]}
                    {b.confianza && (
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                          b.confianza === "alta"
                            ? "bg-oliva-100 text-oliva-900"
                            : b.confianza === "media"
                              ? "bg-oliva-50 text-oliva-700"
                              : "bg-terracota-500/10 text-terracota-600"
                        }`}
                      >
                        confianza {b.confianza}
                      </span>
                    )}
                    {b.fuente_url && (
                      <a href={b.fuente_url} target="_blank" rel="noopener" className="ml-2 inline-flex items-center gap-1 hover:underline">
                        original <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    )}
                  </p>
                </div>

                <form id={`b-${b.id}`} action={resolverBorradorAdmin} className="grid gap-4 sm:grid-cols-[140px_1fr]">
                  <input type="hidden" name="evento_id" value={b.id} />
                  <input type="hidden" name="slug_negocio" value={b.negocio?.slug ?? ""} />
                  <input type="hidden" name="decision" value="publicar" />
                  {b.imagen ? (
                    <a href={b.imagen} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl bg-oliva-50">
                      <Image src={b.imagen} alt="" width={280} height={350} className="h-auto w-full object-cover" unoptimized />
                    </a>
                  ) : (
                    <div className="hidden sm:block" />
                  )}
                  <div className="space-y-3">
                    <div>
                      <label htmlFor={`t-${b.id}`} className="block text-sm font-medium text-oliva-700">
                        Título
                      </label>
                      <input id={`t-${b.id}`} name="titulo" type="text" required defaultValue={b.titulo} className={CAMPO} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`f-${b.id}`} className="block text-sm font-medium text-oliva-700">
                          Día y hora <span className="font-normal text-oliva-500">({fechaEventoAbsoluta(b.fecha_inicio, b.es_todo_el_dia)})</span>
                        </label>
                        <input
                          id={`f-${b.id}`}
                          name="fecha_inicio"
                          type="datetime-local"
                          required
                          defaultValue={horaJaenParaInput(b.fecha_inicio)}
                          className={CAMPO}
                        />
                        <label className="mt-1 flex items-center gap-2 text-sm text-oliva-700">
                          <input type="checkbox" name="es_todo_el_dia" defaultChecked={b.es_todo_el_dia} className="h-4 w-4 accent-terracota-600" />
                          Todo el día
                        </label>
                      </div>
                      <div>
                        <label htmlFor={`p-${b.id}`} className="block text-sm font-medium text-oliva-700">
                          Precio
                        </label>
                        <input id={`p-${b.id}`} name="precio_texto" type="text" defaultValue={b.precio_texto ?? ""} className={CAMPO} />
                        <label className="mt-1 flex items-center gap-2 text-sm text-oliva-700">
                          <input type="checkbox" name="es_gratis" defaultChecked={b.es_gratis} className="h-4 w-4 accent-terracota-600" />
                          Gratis
                        </label>
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`d-${b.id}`} className="block text-sm font-medium text-oliva-700">
                        Descripción
                      </label>
                      <textarea id={`d-${b.id}`} name="descripcion" rows={2} defaultValue={b.descripcion ?? ""} className={CAMPO} />
                    </div>
                  </div>
                </form>

                <div className="mt-4 flex flex-wrap gap-3 sm:pl-[156px]">
                  <button
                    type="submit"
                    form={`b-${b.id}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-oliva-900 px-5 text-base font-semibold text-white hover:bg-oliva-700 transition-colors"
                  >
                    <Check size={18} aria-hidden="true" />
                    Publicar
                  </button>
                  <form action={resolverBorradorAdmin}>
                    <input type="hidden" name="evento_id" value={b.id} />
                    <input type="hidden" name="decision" value="descartar" />
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-oliva-100 px-5 text-base font-medium text-oliva-700 hover:bg-terracota-600/10 hover:text-terracota-600 transition-colors"
                    >
                      <X size={18} aria-hidden="true" />
                      Descartar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-[0.2em] text-oliva-600">
          Publicados esta semana desde redes ({(publicados ?? []).length})
        </h2>
        {(publicados ?? []).length === 0 ? (
          <EstadoVacio mensaje="Nada publicado desde redes en los últimos 7 días." />
        ) : (
          <ul className="divide-y divide-oliva-100 rounded-2xl bg-white shadow-sm">
            {publicados!.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-oliva-900">
                    <Link href={`/eventos`} className="hover:underline">
                      {e.titulo}
                    </Link>
                  </p>
                  <p className="text-sm text-oliva-600">
                    {fechaEventoAbsoluta(e.fecha_inicio, e.es_todo_el_dia)} ·{" "}
                    {e.negocio?.nombre ?? e.lugar_nombre ?? "sin lugar"} · {e.fuente_nombre ?? NOMBRE_ORIGEN[e.origen]}
                    {e.fuente_url && (
                      <>
                        {" "}
                        <a href={e.fuente_url} target="_blank" rel="noreferrer" className="inline-flex align-middle hover:text-oliva-900">
                          <ExternalLink size={14} aria-label="Ver publicación original" />
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <form action={quitarEventoRedAdmin}>
                  <input type="hidden" name="evento_id" value={e.id} />
                  <input type="hidden" name="slug_negocio" value={e.negocio?.slug ?? ""} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-full border border-terracota-300 px-3 py-1.5 text-sm font-semibold text-terracota-600 hover:bg-terracota-500/10"
                  >
                    <X size={14} /> Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(rotos ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-[0.2em] text-terracota-600">
            Redes que no se pueden leer ({rotos!.length})
          </h2>
          <p className="mb-3 text-sm text-oliva-600">
            Cuenta personal (no Business), usuario mal escrito o página inexistente. Corrige el dato en la ficha y se
            vuelve a intentar sola.
          </p>
          <ul className="divide-y divide-oliva-100 rounded-2xl bg-white shadow-sm">
            {rotos!.map((r) => (
              <li key={`${r.negocio_id}-${r.plataforma}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span>
                  <strong className="text-oliva-900">{r.negocio?.nombre ?? r.negocio_id}</strong> · {r.plataforma} ·{" "}
                  <code className="text-oliva-700">{r.identificador}</code>
                </span>
                <span className="text-oliva-600">{r.ultimo_error}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
