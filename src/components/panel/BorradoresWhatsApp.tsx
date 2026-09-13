import Image from "next/image";
import { MessageCircle } from "lucide-react";
import BorrarEvento from "./BorrarEvento";
import { publicarBorradorEvento } from "@/lib/actions/eventos";
import { horaJaenParaInput } from "@/lib/eventos";

export interface BorradorPanel {
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
  created_at: string;
}

const NOMBRE_ORIGEN = { whatsapp: "WhatsApp", facebook: "Facebook", instagram: "Instagram" } as const;

interface Props {
  slugNegocio: string;
  borradores: BorradorPanel[];
  /** Número de WhatsApp de Jaén Guía, para la ayuda. */
  numeroWhatsApp: string | null;
}

const CAMPO =
  "mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400";
const ETIQUETA = "block text-base font-medium text-oliva-700";

// Borradores que llegaron por WhatsApp (migración 0013): el dueño mandó
// el cartel, Claude lo leyó y aquí se confirma. Cada borrador es su
// propio formulario: lo normal es que solo haya que pulsar "Publicar",
// pero si Claude leyó mal la hora se corrige en el sitio, sin ir a
// otra pantalla.
export default function BorradoresWhatsApp({ slugNegocio, borradores, numeroWhatsApp }: Props) {
  return (
    <section id="borradores" className="mt-10 scroll-mt-24">
      <header className="mb-4">
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-oliva-900">
          <MessageCircle size={24} strokeWidth={1.5} className="text-terracota-500" aria-hidden="true" />
          Para revisar
        </h2>
        <p className="mt-1 text-base text-oliva-700">
          Lo que hemos visto en tu Facebook o Instagram, o lo que nos has mandado
          {numeroWhatsApp ? (
            <>
              {" "}
              por WhatsApp al{" "}
              <a href={`https://wa.me/${numeroWhatsApp.replace(/\D/g, "")}`} className="font-semibold text-terracota-600 hover:underline">
                +{numeroWhatsApp.replace(/\D/g, "")}
              </a>
            </>
          ) : (
            " por WhatsApp"
          )}
          . Revísalo y publícalo con un toque; nada sale en la agenda sin que lo confirmes.
        </p>
      </header>

      {borradores.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-base text-oliva-700 shadow-sm">
          No hay nada pendiente de revisar.
        </p>
      ) : (
        <ul className="space-y-4">
          {borradores.map((b) => (
            <li key={b.id} className="rounded-2xl bg-white p-6 shadow-sm">
              {/* BorrarEvento lleva su propio <form>, y un form no puede
                  anidar otro: el de publicar va aparte y el botón lo
                  apunta con form={id}. */}
              <form id={`borrador-${b.id}`} action={publicarBorradorEvento} className="grid gap-5 sm:grid-cols-[160px_1fr]">
                <input type="hidden" name="evento_id" value={b.id} />
                <input type="hidden" name="slug_negocio" value={slugNegocio} />

                {b.imagen ? (
                  <a href={b.imagen} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl bg-oliva-50">
                    <Image
                      src={b.imagen}
                      alt=""
                      width={320}
                      height={400}
                      className="h-auto w-full object-cover"
                      unoptimized
                    />
                  </a>
                ) : (
                  <div className="hidden sm:block" />
                )}

                <div className="space-y-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-terracota-600">
                    Visto en {NOMBRE_ORIGEN[b.origen]}
                    {b.fuente_url && (
                      <>
                        {" · "}
                        <a href={b.fuente_url} target="_blank" rel="noopener" className="font-medium normal-case tracking-normal text-oliva-600 hover:underline">
                          ver original
                        </a>
                      </>
                    )}
                  </p>
                  <div>
                    <label htmlFor={`titulo-${b.id}`} className={ETIQUETA}>
                      Título
                    </label>
                    <input
                      id={`titulo-${b.id}`}
                      name="titulo"
                      type="text"
                      required
                      minLength={3}
                      maxLength={120}
                      defaultValue={b.titulo}
                      className={CAMPO}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`fecha-${b.id}`} className={ETIQUETA}>
                        Día y hora
                      </label>
                      <input
                        id={`fecha-${b.id}`}
                        name="fecha_inicio"
                        type="datetime-local"
                        required
                        defaultValue={horaJaenParaInput(b.fecha_inicio)}
                        className={CAMPO}
                      />
                      <label className="mt-2 flex min-h-11 items-center gap-2.5 text-base text-oliva-700">
                        <input
                          type="checkbox"
                          name="es_todo_el_dia"
                          defaultChecked={b.es_todo_el_dia}
                          className="h-5 w-5 accent-terracota-600"
                        />
                        Dura todo el día (no se muestra la hora)
                      </label>
                    </div>
                    <div>
                      <label htmlFor={`precio-${b.id}`} className={ETIQUETA}>
                        Precio
                      </label>
                      <input
                        id={`precio-${b.id}`}
                        name="precio_texto"
                        type="text"
                        defaultValue={b.precio_texto ?? ""}
                        placeholder="12 € anticipada / 15 € taquilla"
                        className={CAMPO}
                      />
                      <label className="mt-2 flex min-h-11 items-center gap-2.5 text-base text-oliva-700">
                        <input
                          type="checkbox"
                          name="es_gratis"
                          defaultChecked={b.es_gratis}
                          className="h-5 w-5 accent-terracota-600"
                        />
                        Gratis / entrada libre
                      </label>
                    </div>
                  </div>

                  <div>
                    <label htmlFor={`descripcion-${b.id}`} className={ETIQUETA}>
                      Descripción <span className="font-normal text-oliva-500">(opcional)</span>
                    </label>
                    <textarea
                      id={`descripcion-${b.id}`}
                      name="descripcion"
                      rows={3}
                      defaultValue={b.descripcion ?? ""}
                      className={CAMPO}
                    />
                  </div>

                </div>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-3 sm:pl-[180px]">
                <button
                  type="submit"
                  form={`borrador-${b.id}`}
                  className="inline-flex min-h-11 items-center rounded-full bg-terracota-600 px-5 text-base font-semibold text-white hover:bg-terracota-700 transition-colors"
                >
                  Publicar en la agenda
                </button>
                <BorrarEvento eventoId={b.id} titulo={b.titulo} slugNegocio={slugNegocio} etiqueta="Descartar" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
