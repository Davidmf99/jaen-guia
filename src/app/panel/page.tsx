import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ChevronRight, Clock, MessageCircle, Star, Store } from "lucide-react";
import EstadoVacio from "@/components/home/EstadoVacio";
import { createClient } from "@/lib/supabase/server";
import { filtroEventosVigentes } from "@/lib/eventos";

export const metadata: Metadata = {
  title: "Mis negocios · Jaén Guía",
  description: "Gestiona las fichas de tus negocios en Jaén Guía.",
};

interface Membresia {
  estado: "pendiente" | "aprobado" | "rechazado";
  rol: "dueno" | "editor";
  created_at: string;
  negocio: {
    id: string;
    slug: string;
    nombre: string;
    direccion: string | null;
    activo: boolean;
    plan: string;
  } | null;
}

interface Resumen {
  eventos: number;
  borradores: number;
}

// Un perfil puede gestionar varios negocios (negocios_miembros,
// migración 0011): Panaceite son dos locales con la misma dueña. Aunque
// solo haya uno, se enseña la lista: así el dueño ve siempre "Mis
// negocios" como punto de partida y no aterriza de golpe en el editor.
export default async function PanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?volver=%2Fpanel");

  const { data: membresias } = await supabase
    .from("negocios_miembros")
    .select("estado, rol, created_at, negocio:negocios(id, slug, nombre, direccion, activo, plan)")
    .eq("perfil_id", user.id)
    .order("created_at", { ascending: false })
    .returns<Membresia[]>();

  const todas = (membresias ?? []).filter((m) => m.negocio !== null);
  const aprobadas = todas.filter((m) => m.estado === "aprobado");
  const pendientes = todas.filter((m) => m.estado === "pendiente");
  const rechazadas = todas.filter((m) => m.estado === "rechazado");

  // Eventos vigentes y borradores pendientes por negocio, para que la
  // lista diga qué toca hacer en cada local sin entrar.
  const resumen = new Map<string, Resumen>();
  const idsAprobados = aprobadas.map((m) => m.negocio!.id);
  if (idsAprobados.length > 0) {
    const [{ data: vigentes }, { data: borradores }] = await Promise.all([
      supabase
        .from("eventos")
        .select("negocio_id")
        .in("negocio_id", idsAprobados)
        .eq("estado", "publicado")
        .or(filtroEventosVigentes())
        .returns<{ negocio_id: string }[]>(),
      supabase
        .from("eventos")
        .select("negocio_id")
        .in("negocio_id", idsAprobados)
        .eq("estado", "borrador")
        .in("origen", ["whatsapp", "facebook", "instagram"])
        .returns<{ negocio_id: string }[]>(),
    ]);
    for (const id of idsAprobados) resumen.set(id, { eventos: 0, borradores: 0 });
    for (const e of vigentes ?? []) resumen.get(e.negocio_id)!.eventos++;
    for (const b of borradores ?? []) resumen.get(b.negocio_id)!.borradores++;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-oliva-900">Mis negocios</h1>
        <p className="mt-2 text-oliva-700">
          Los locales que gestionas en Jaén Guía.
        </p>
      </header>

      {todas.length === 0 ? (
        <div className="space-y-6">
          <EstadoVacio
            icono={Store}
            mensaje="Todavía no gestionas ningún negocio."
          />
          <div className="rounded-2xl bg-white p-6 shadow-sm text-oliva-700">
            <p className="font-semibold text-oliva-900">¿Tienes un bar, tienda o local en Jaén?</p>
            <p className="mt-2">
              Búscalo en la guía y, en su ficha, pulsa «¿Es tu negocio?» para pedir
              gestionarlo. Si aún no aparece,{" "}
              <Link href="/contacto" className="font-semibold text-terracota-600 hover:underline">
                escríbenos
              </Link>{" "}
              y lo damos de alta.{" "}
              <Link href="/para-negocios" className="font-semibold text-terracota-600 hover:underline">
                Cómo funciona
              </Link>
              .
            </p>
            <Link
              href="/para-negocios"
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-oliva-900 px-5 text-base font-semibold text-white hover:bg-terracota-700 transition-colors"
            >
              Buscar mi negocio
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {aprobadas.length > 0 && (
            <section>
              <ul className="space-y-3">
                {aprobadas.map((m) => {
                  const n = m.negocio!;
                  const r = resumen.get(n.id) ?? { eventos: 0, borradores: 0 };
                  const destacado = n.plan === "destacado";
                  return (
                    <li key={n.id}>
                      <Link
                        href={`/panel/${n.slug}`}
                        className={`flex items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm hover:shadow-md transition-shadow ${
                          destacado ? "ring-2 ring-terracota-500/60" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-sans text-lg font-bold text-oliva-900">{n.nombre}</p>
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                                destacado ? "bg-terracota-500 text-white" : "bg-oliva-50 text-oliva-700"
                              }`}
                            >
                              {destacado && <Star size={12} aria-hidden="true" className="fill-white" />}
                              {destacado ? "Destacado" : "Gratis"}
                            </span>
                          </div>
                          {n.direccion && <p className="truncate text-oliva-600">{n.direccion}</p>}
                          {!n.activo && (
                            <p className="mt-1 text-sm font-semibold text-terracota-600">Pendiente de publicar</p>
                          )}
                          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-oliva-700">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays size={15} aria-hidden="true" className="text-oliva-500" />
                              {r.eventos === 1 ? "1 evento vigente" : `${r.eventos} eventos vigentes`}
                            </span>
                            {r.borradores > 0 && (
                              <span className="inline-flex items-center gap-1.5 font-semibold text-terracota-600">
                                <MessageCircle size={15} aria-hidden="true" />
                                {r.borradores === 1 ? "1 borrador por revisar" : `${r.borradores} borradores por revisar`}
                              </span>
                            )}
                          </p>
                        </div>
                        <ChevronRight size={20} className="shrink-0 text-oliva-500" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {pendientes.length > 0 && (
            <section>
              <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-[0.2em] text-terracota-600">
                En revisión
              </h2>
              <ul className="space-y-3">
                {pendientes.map((m) => (
                  <li
                    key={m.negocio!.id}
                    className="flex items-center gap-4 rounded-2xl border border-dashed border-oliva-200 bg-tierra-50 p-5"
                  >
                    <Clock size={20} className="shrink-0 text-oliva-500" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-oliva-900">{m.negocio!.nombre}</p>
                      <p className="text-sm text-oliva-600">
                        Estamos comprobando que el negocio es tuyo. Te avisaremos.
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {rechazadas.length > 0 && (
            <section>
              <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-[0.2em] text-oliva-600">
                No aprobadas
              </h2>
              <ul className="space-y-3">
                {rechazadas.map((m) => (
                  <li key={m.negocio!.id} className="rounded-2xl bg-white p-5 text-oliva-700 shadow-sm">
                    <p className="font-semibold text-oliva-900">{m.negocio!.nombre}</p>
                    <p className="mt-1 text-sm">
                      No hemos podido confirmar que gestionas este negocio.{" "}
                      <Link href="/contacto" className="font-semibold text-terracota-600 hover:underline">
                        Escríbenos
                      </Link>{" "}
                      si crees que es un error.
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
