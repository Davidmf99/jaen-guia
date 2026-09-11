import Link from "next/link";
import { Store, Clock, PencilLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { solicitarGestionNegocio } from "@/lib/actions/negocios";

interface Props {
  negocioId: string;
  slug: string;
  nombre: string;
  usuarioId: string | null;
  /** Texto que dejó la Server Action en ?solicitud= (ok o mensaje de error). */
  aviso?: string;
}

// Bloque al pie de la ficha que abre el flujo de "reclamar" un negocio
// (negocios_miembros, migración 0011). Estados:
//   - ya soy miembro aprobado  → enlace al panel
//   - tengo solicitud pendiente → "en revisión"
//   - rechazada                → nada (se explica en /panel)
//   - nadie lo gestiona        → formulario (o enlace a login)
//   - lo gestiona otra persona → nada
export default async function GestionarNegocio({ negocioId, slug, nombre, usuarioId, aviso }: Props) {
  const supabase = await createClient();

  const [{ data: gestionado }, { data: miMembresia }] = await Promise.all([
    supabase.rpc("negocio_gestionado", { p_negocio_id: negocioId }),
    usuarioId
      ? supabase
          .from("negocios_miembros")
          .select("estado")
          .eq("negocio_id", negocioId)
          .eq("perfil_id", usuarioId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const estado = miMembresia?.estado as "pendiente" | "aprobado" | "rechazado" | undefined;

  if (estado === "aprobado") {
    return (
      <Contenedor id="gestionar">
        <Link
          href={`/panel/${slug}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-oliva-900 px-5 text-base font-semibold text-white hover:bg-terracota-700 transition-colors"
        >
          <PencilLine size={18} aria-hidden="true" />
          Editar la ficha de {nombre}
        </Link>
      </Contenedor>
    );
  }

  if (estado === "pendiente" || aviso === "ok") {
    return (
      <Contenedor id="gestionar">
        <p className="flex items-center gap-3 font-semibold text-oliva-900">
          <Clock size={20} aria-hidden="true" className="shrink-0 text-terracota-500" />
          Solicitud recibida. Estamos comprobando que el negocio es tuyo; lo verás en{" "}
          <Link href="/panel" className="text-terracota-600 hover:underline">
            Mis negocios
          </Link>
          .
        </p>
      </Contenedor>
    );
  }

  if (estado === "rechazado" || gestionado === true) return null;

  if (!usuarioId) {
    return (
      <Contenedor id="gestionar">
        <p className="text-oliva-700">
          <span className="font-semibold text-oliva-900">¿Es tu negocio?</span>{" "}
          <Link
            href={`/login?volver=${encodeURIComponent(`/negocio/${slug}#gestionar`)}`}
            className="font-semibold text-terracota-600 hover:underline"
          >
            Inicia sesión
          </Link>{" "}
          para pedir gestionarlo y editar su ficha.
        </p>
      </Contenedor>
    );
  }

  return (
    <Contenedor id="gestionar">
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 font-semibold text-oliva-900 marker:hidden [&::-webkit-details-marker]:hidden">
          <Store size={20} aria-hidden="true" className="shrink-0 text-terracota-500" />
          ¿Es tu negocio? Pide gestionarlo
        </summary>
        <form action={solicitarGestionNegocio} className="mt-4 space-y-4">
          <input type="hidden" name="negocio_id" value={negocioId} />
          <input type="hidden" name="slug" value={slug} />
          {aviso && aviso !== "ok" && (
            <p role="alert" className="rounded-2xl bg-terracota-500/10 px-4 py-3 font-semibold text-terracota-600">
              {aviso}
            </p>
          )}
          <p className="text-oliva-700">
            Comprobaremos que eres quien lo lleva (normalmente llamando al teléfono del
            local) y te daremos acceso para editar horarios, fotos, carta y eventos.
          </p>
          <div>
            <label htmlFor="telefono_contacto" className="block text-base font-medium text-oliva-700">
              Teléfono donde localizarte
            </label>
            <input
              id="telefono_contacto"
              name="telefono_contacto"
              type="tel"
              maxLength={30}
              className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
            />
          </div>
          <div>
            <label htmlFor="mensaje" className="block text-base font-medium text-oliva-700">
              Cuéntanos quién eres{" "}
              <span className="font-normal text-oliva-600">(opcional)</span>
            </label>
            <textarea
              id="mensaje"
              name="mensaje"
              rows={3}
              maxLength={500}
              placeholder="Soy la gerente desde 2019, podéis llamarme por las mañanas."
              className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-full bg-oliva-900 px-5 text-base font-semibold text-white hover:bg-terracota-700 transition-colors"
          >
            Enviar solicitud
          </button>
        </form>
      </details>
    </Contenedor>
  );
}

function Contenedor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[2rem] border border-oliva-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      {children}
    </section>
  );
}
