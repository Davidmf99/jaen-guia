import { Share2, AtSign, Check } from "lucide-react";
import { desconectarFacebook, revisarFacebookAhora } from "@/lib/actions/facebook";

export interface ConexionPanel {
  page_id: string;
  page_nombre: string | null;
  ig_username: string | null;
  ultima_sync: string;
  ultimo_error: string | null;
}

interface Props {
  negocioId: string;
  slugNegocio: string;
  conexion: ConexionPanel | null;
  /** Sin FACEBOOK_APP_ID el botón se esconde y se explica que llegará. */
  disponible: boolean;
}

const RELATIVO = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

function haceCuanto(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return RELATIVO.format(-min, "minute");
  if (min < 60 * 24) return RELATIVO.format(-Math.round(min / 60), "hour");
  return RELATIVO.format(-Math.round(min / (60 * 24)), "day");
}

// "Publica una vez, en tu Facebook, y nosotros lo traemos". La conexión
// es un enlace a /api/facebook/conectar (no un form): es una navegación
// a Meta y vuelta, no una acción sobre nuestros datos.
export default function ConexionFacebook({ negocioId, slugNegocio, conexion, disponible }: Props) {
  return (
    <section id="facebook" className="mt-10 scroll-mt-24">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-oliva-900">
          <Share2 size={24} strokeWidth={1.5} className="text-terracota-500" aria-hidden="true" />
          Tu Facebook e Instagram
        </h2>
        <p className="mt-1 text-base text-oliva-700">
          Conecta la página del local una vez. Cada pocas horas miramos tus eventos y publicaciones y te los
          proponemos aquí para publicarlos en la agenda con un toque. No publicamos nada en tu nombre.
        </p>
      </header>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        {conexion ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-base font-semibold text-oliva-900">
                <Check size={18} className="text-green-700" aria-hidden="true" />
                Conectado con «{conexion.page_nombre ?? conexion.page_id}»
              </p>
              {conexion.ig_username && (
                <p className="mt-1 flex items-center gap-1.5 text-base text-oliva-700">
                  <AtSign size={16} aria-hidden="true" />{conexion.ig_username}
                </p>
              )}
              <p className="mt-1 text-sm text-oliva-600">Última revisión {haceCuanto(conexion.ultima_sync)}.</p>
              {conexion.ultimo_error && (
                <p className="mt-2 text-sm text-terracota-600">
                  La última revisión falló: {conexion.ultimo_error}. Si sigue así, desconecta y vuelve a conectar.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={revisarFacebookAhora}>
                <input type="hidden" name="negocio_id" value={negocioId} />
                <input type="hidden" name="slug" value={slugNegocio} />
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center rounded-full bg-oliva-900 px-4 text-base font-semibold text-white hover:bg-terracota-700 transition-colors"
                >
                  Revisar ahora
                </button>
              </form>
              <form action={desconectarFacebook}>
                <input type="hidden" name="negocio_id" value={negocioId} />
                <input type="hidden" name="slug" value={slugNegocio} />
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center rounded-full border border-oliva-100 px-4 text-base font-medium text-oliva-700 hover:bg-oliva-100 transition-colors"
                >
                  Desconectar
                </button>
              </form>
            </div>
          </div>
        ) : disponible ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-base text-oliva-700">
              Te pediremos permiso solo para <strong>leer</strong> la página y su Instagram.
            </p>
            <a
              href={`/api/facebook/conectar?negocio=${encodeURIComponent(slugNegocio)}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1877F2] px-5 text-base font-semibold text-white hover:bg-[#145fc4] transition-colors"
            >
              Conectar Facebook
            </a>
          </div>
        ) : (
          <p className="text-base text-oliva-700">
            Muy pronto. Mientras tanto puedes mandarnos el cartel por WhatsApp o crear el evento aquí abajo.
          </p>
        )}
      </div>
    </section>
  );
}
