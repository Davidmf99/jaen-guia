import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, ExternalLink, X } from "lucide-react";
import EstadoVacio from "@/components/home/EstadoVacio";
import FormularioEvento from "@/components/panel/FormularioEvento";
import { createClient } from "@/lib/supabase/server";
import { crearEventoComoAdmin } from "@/lib/actions/eventos";

export const metadata: Metadata = {
  title: "Destacados sin eventos · Jaén Guía",
  robots: { index: false, follow: false },
};

// Ventana sin capturas automáticas a partir de la cual un destacado
// entra en la lista de revisión manual.
const DIAS_SIN_EVENTOS = 14;
const ORIGENES_AUTOMATICOS = ["whatsapp", "facebook", "instagram"];

interface NegocioDestacado {
  id: string;
  slug: string;
  nombre: string;
  direccion: string | null;
  instagram: string | null;
  categoria_id: string | null;
}

interface PageProps {
  searchParams: Promise<{ ok?: string; error?: string; publicar?: string }>;
}

const FECHA = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "numeric",
  month: "short",
  year: "numeric",
});

// Las stories de Instagram/Facebook no tienen API, así que para los
// negocios de pago (plan 'destacado') la revisión es manual: esta lista
// dice a quién mirar. Un negocio sale si no le hemos capturado nada
// automáticamente en los últimos DIAS_SIN_EVENTOS días. Desde aquí
// también se publica un evento en su nombre (crearEventoComoAdmin).
export default async function DestacadosSinEventosPage({ searchParams }: PageProps) {
  const { ok, error, publicar } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?volver=%2Fadmin%2Fdestacados-sin-eventos");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol !== "admin") redirect("/");

  const { data: destacados } = await supabase
    .from("negocios")
    .select("id, slug, nombre, direccion, instagram, categoria_id")
    .eq("plan", "destacado")
    .eq("activo", true)
    .order("nombre")
    .returns<NegocioDestacado[]>();

  const negocios = destacados ?? [];
  const ids = negocios.map((n) => n.id);

  // Última captura automática por negocio. Cuenta cualquier estado: un
  // borrador sin confirmar también demuestra que el bar publica.
  const ultimaCaptura = new Map<string, string>();
  if (ids.length > 0) {
    const { data: capturas } = await supabase
      .from("eventos")
      .select("negocio_id, created_at")
      .in("negocio_id", ids)
      .in("origen", ORIGENES_AUTOMATICOS)
      .order("created_at", { ascending: false })
      .returns<{ negocio_id: string; created_at: string }[]>();
    for (const c of capturas ?? []) {
      if (!ultimaCaptura.has(c.negocio_id)) ultimaCaptura.set(c.negocio_id, c.created_at);
    }
  }

  const limite = new Date().getTime() - DIAS_SIN_EVENTOS * 24 * 60 * 60 * 1000;
  const sinEventos = negocios.filter((n) => {
    const ultima = ultimaCaptura.get(n.id);
    return !ultima || new Date(ultima).getTime() < limite;
  });

  const negocioAPublicar = publicar ? negocios.find((n) => n.slug === publicar) ?? null : null;

  const { data: categorias } = negocioAPublicar
    ? await supabase.from("categorias").select("id, nombre").order("orden").returns<{ id: string; nombre: string }[]>()
    : { data: null };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-oliva-900">Destacados sin eventos</h1>
        <p className="mt-2 text-oliva-700">
          Negocios con plan Destacado sin nada capturado de sus redes en los últimos {DIAS_SIN_EVENTOS} días.
          Toca mirar su Instagram a mano (stories incluidas) y publicar lo que haya.
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

      {negocioAPublicar && (
        <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold text-oliva-900">Publicar evento</h2>
              <p className="mt-1 text-base text-oliva-700">
                En nombre de <strong>{negocioAPublicar.nombre}</strong>. Saldrá como un evento del propio negocio.
              </p>
            </div>
            <Link
              href="/admin/destacados-sin-eventos"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-oliva-200 px-4 text-base font-semibold text-oliva-900 hover:border-terracota-600 hover:text-terracota-600 transition-colors"
            >
              <X size={18} aria-hidden="true" />
              Cancelar
            </Link>
          </header>
          <FormularioEvento
            negocioId={negocioAPublicar.id}
            slugNegocio={negocioAPublicar.slug}
            nombreNegocio={negocioAPublicar.nombre}
            direccionNegocio={negocioAPublicar.direccion}
            categoriaIdNegocio={negocioAPublicar.categoria_id}
            categorias={categorias ?? []}
            accion={crearEventoComoAdmin}
          />
        </section>
      )}

      <section>
        <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-[0.2em] text-terracota-600">
          Para revisar ({sinEventos.length} de {negocios.length} destacados)
        </h2>
        {sinEventos.length === 0 ? (
          <EstadoVacio
            mensaje={
              negocios.length === 0
                ? "Todavía no hay negocios con plan Destacado."
                : "Todos los destacados tienen eventos recientes."
            }
          />
        ) : (
          <ul className="space-y-4">
            {sinEventos.map((n) => {
              const ultima = ultimaCaptura.get(n.id);
              const usuario = n.instagram?.replace(/^@/, "") ?? null;
              return (
                <li key={n.id} className="rounded-2xl bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-xl font-semibold text-oliva-900">{n.nombre}</h3>
                      <dl className="mt-2 space-y-1 text-base text-oliva-700">
                        <div className="flex gap-2">
                          <dt className="text-oliva-600">Instagram:</dt>
                          <dd>
                            {usuario ? (
                              <a
                                href={`https://www.instagram.com/${usuario}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-terracota-600 hover:underline"
                              >
                                @{usuario}
                                <ExternalLink size={14} aria-hidden="true" />
                              </a>
                            ) : (
                              <span className="text-terracota-600">sin usuario en la ficha</span>
                            )}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-oliva-600">Última captura:</dt>
                          <dd>{ultima ? FECHA.format(new Date(ultima)) : "ninguna"}</dd>
                        </div>
                      </dl>
                    </div>
                    <Link
                      href={`/negocio/${n.slug}`}
                      className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-oliva-700 hover:text-terracota-600"
                    >
                      Ver ficha
                      <ExternalLink size={16} aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="mt-5">
                    <Link
                      href={`/admin/destacados-sin-eventos?publicar=${encodeURIComponent(n.slug)}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-oliva-900 px-5 text-base font-semibold text-white hover:bg-oliva-700 transition-colors"
                    >
                      <CalendarPlus size={18} aria-hidden="true" />
                      Publicar evento
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
