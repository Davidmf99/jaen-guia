import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, X, Phone, ExternalLink } from "lucide-react";
import EstadoVacio from "@/components/home/EstadoVacio";
import { createClient } from "@/lib/supabase/server";
import { resolverSolicitudNegocio } from "@/lib/actions/negocios";

export const metadata: Metadata = {
  title: "Solicitudes de negocio · Jaén Guía",
  robots: { index: false, follow: false },
};

interface Solicitud {
  negocio_id: string;
  perfil_id: string;
  rol: string;
  estado: "pendiente" | "aprobado" | "rechazado";
  mensaje: string | null;
  telefono_contacto: string | null;
  created_at: string;
  negocio: {
    slug: string;
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    web: string | null;
    activo: boolean;
  } | null;
  perfil: {
    nombre: string | null;
    apellidos: string | null;
    username: string | null;
  } | null;
}

interface PageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

// Bandeja del admin para aprobar quién gestiona cada negocio
// (negocios_miembros, migración 0011). La verificación es manual: se
// compara el teléfono que deja el solicitante con el del local (el que
// vino de Google) y, si hace falta, se llama.
export default async function SolicitudesPage({ searchParams }: PageProps) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?volver=%2Fadmin%2Fsolicitudes");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol !== "admin") redirect("/");

  const { data: solicitudes } = await supabase
    .from("negocios_miembros")
    .select(
      "negocio_id, perfil_id, rol, estado, mensaje, telefono_contacto, created_at, negocio:negocios(slug, nombre, direccion, telefono, web, activo), perfil:perfiles!negocios_miembros_perfil_id_fkey(nombre, apellidos, username)"
    )
    .order("created_at", { ascending: false })
    .returns<Solicitud[]>();

  const pendientes = (solicitudes ?? []).filter((s) => s.estado === "pendiente");
  const resueltas = (solicitudes ?? []).filter((s) => s.estado !== "pendiente").slice(0, 30);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-oliva-900">Solicitudes de negocio</h1>
        <p className="mt-2 text-oliva-700">
          Quién ha pedido gestionar qué. Comprueba el teléfono contra el del local antes de aprobar.
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
          Pendientes ({pendientes.length})
        </h2>
        {pendientes.length === 0 ? (
          <EstadoVacio mensaje="No hay solicitudes pendientes." />
        ) : (
          <ul className="space-y-4">
            {pendientes.map((s) => (
              <li key={`${s.negocio_id}-${s.perfil_id}`} className="rounded-2xl bg-white p-6 shadow-sm">
                <TarjetaSolicitud solicitud={s} />
                <div className="mt-5 flex flex-wrap gap-3">
                  <form action={resolverSolicitudNegocio}>
                    <CamposOcultos solicitud={s} />
                    <input type="hidden" name="decision" value="aprobar" />
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-oliva-900 px-5 text-base font-semibold text-white hover:bg-oliva-700 transition-colors"
                    >
                      <Check size={18} aria-hidden="true" />
                      Aprobar
                    </button>
                  </form>
                  <form action={resolverSolicitudNegocio}>
                    <CamposOcultos solicitud={s} />
                    <input type="hidden" name="decision" value="rechazar" />
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-oliva-200 px-5 text-base font-semibold text-oliva-900 hover:border-terracota-600 hover:text-terracota-600 transition-colors"
                    >
                      <X size={18} aria-hidden="true" />
                      Rechazar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resueltas.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-[0.2em] text-oliva-600">
            Últimas resueltas
          </h2>
          <ul className="space-y-3">
            {resueltas.map((s) => (
              <li
                key={`${s.negocio_id}-${s.perfil_id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-oliva-900">{s.negocio?.nombre}</p>
                  <p className="truncate text-sm text-oliva-600">{nombrePerfil(s)}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                    s.estado === "aprobado" ? "bg-oliva-100 text-oliva-900" : "bg-terracota-500/10 text-terracota-600"
                  }`}
                >
                  {s.estado}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function nombrePerfil(s: Solicitud) {
  const completo = [s.perfil?.nombre, s.perfil?.apellidos].filter(Boolean).join(" ");
  const usuario = s.perfil?.username ? `@${s.perfil.username}` : null;
  return [completo, usuario].filter(Boolean).join(" · ") || "Usuario sin nombre";
}

function CamposOcultos({ solicitud: s }: { solicitud: Solicitud }) {
  return (
    <>
      <input type="hidden" name="negocio_id" value={s.negocio_id} />
      <input type="hidden" name="perfil_id" value={s.perfil_id} />
      <input type="hidden" name="slug" value={s.negocio?.slug ?? ""} />
    </>
  );
}

function TarjetaSolicitud({ solicitud: s }: { solicitud: Solicitud }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-oliva-600">Negocio</p>
        <p className="mt-1 font-sans text-lg font-bold text-oliva-900">
          {s.negocio ? (
            <Link
              href={`/negocio/${s.negocio.slug}`}
              className="inline-flex items-center gap-1.5 hover:text-terracota-600"
            >
              {s.negocio.nombre}
              <ExternalLink size={14} aria-hidden="true" />
            </Link>
          ) : (
            "Negocio borrado"
          )}
        </p>
        {s.negocio?.direccion && <p className="text-oliva-700">{s.negocio.direccion}</p>}
        {s.negocio?.telefono && (
          <p className="mt-1 flex items-center gap-1.5 text-oliva-700">
            <Phone size={14} aria-hidden="true" />
            Tlf. del local: <span className="font-semibold">{s.negocio.telefono}</span>
          </p>
        )}
        {s.negocio && !s.negocio.activo && (
          <p className="mt-1 text-sm font-semibold text-terracota-600">
            Negocio nuevo, sin publicar. Aprobar lo publica.
          </p>
        )}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-oliva-600">Solicitante</p>
        <p className="mt-1 font-semibold text-oliva-900">{nombrePerfil(s)}</p>
        <p className="text-sm text-oliva-600">
          {new Date(s.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
          {" · "}
          {s.rol}
        </p>
        {s.telefono_contacto && (
          <p className="mt-1 flex items-center gap-1.5 text-oliva-700">
            <Phone size={14} aria-hidden="true" />
            Contacto: <a href={`tel:${s.telefono_contacto}`} className="font-semibold hover:underline">{s.telefono_contacto}</a>
          </p>
        )}
        {s.mensaje && (
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-tierra-50 px-3 py-2 text-oliva-700">{s.mensaje}</p>
        )}
      </div>
    </div>
  );
}
