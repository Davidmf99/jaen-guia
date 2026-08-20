import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MapPin, Phone, Globe, Clock, Star } from "lucide-react";
import Header from "@/components/layout/Header";
import MapaUbicacion from "@/components/negocio/MapaUbicacion";
import { createClient } from "@/lib/supabase/server";
import { calcularPuntuacionMedia } from "@/lib/resenas";
import { getUsuarioYFavoritos } from "@/lib/favoritos";
import BotonFavorito from "@/components/BotonFavorito";
import ImagenNegocio from "@/components/ImagenNegocio";

interface ResenaRow {
  id: string;
  puntuacion: number;
  texto: string | null;
  es_oficial: boolean;
  created_at: string;
  usuario_id: string;
}

interface NegocioFichaRow {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  descripcion_corta: string | null;
  direccion: string | null;
  zona: string | null;
  lat: number | null;
  lng: number | null;
  telefono: string | null;
  web: string | null;
  horario: Record<string, string> | null;
  imagen_portada: string | null;
  google_photo_name: string | null;
  google_photo_atribucion: string | null;
  categoria: { nombre: string } | null;
  resenas: ResenaRow[];
}

// cache() deduplica la consulta entre generateMetadata y el propio Page,
// que en Next se ejecutan por separado para la misma petición.
const getNegocio = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("negocios")
    .select(
      "id, nombre, slug, descripcion, descripcion_corta, direccion, zona, lat, lng, telefono, web, horario, imagen_portada, google_photo_name, google_photo_atribucion, categoria:categorias(nombre), resenas(id, puntuacion, texto, es_oficial, created_at, usuario_id)"
    )
    .eq("slug", slug)
    .single()
    .returns<NegocioFichaRow>();

  if (error || !data) return null;
  return data;
});

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const negocio = await getNegocio(slug);
  if (!negocio) return {};

  return {
    title: `${negocio.nombre} · Jaén Guía`,
    description: negocio.descripcion_corta ?? negocio.descripcion ?? undefined,
  };
}

export default async function NegocioPage({ params }: PageProps) {
  const { slug } = await params;
  const negocio = await getNegocio(slug);
  if (!negocio) notFound();
  const negocioId = negocio.id;

  const { user, favoritoIds } = await getUsuarioYFavoritos();
  const puntuacionMedia = calcularPuntuacionMedia(negocio.resenas);

  const resenasOrdenadas = [...negocio.resenas].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const resenasOficiales = resenasOrdenadas.filter((r) => r.es_oficial);
  const resenasUsuarios = resenasOrdenadas.filter((r) => !r.es_oficial);

  async function crearResena(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const puntuacion = Number(formData.get("puntuacion"));
    if (!Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5) return;

    const texto = String(formData.get("texto") ?? "").trim() || null;

    await supabase.from("resenas").insert({
      negocio_id: negocioId,
      usuario_id: user.id,
      puntuacion,
      texto,
      es_oficial: false,
    });

    revalidatePath(`/negocio/${slug}`);
  }

  return (
    <>
      <Header />
      <main>
        <div className="relative h-64 w-full overflow-hidden md:h-80">
          <ImagenNegocio
            negocioId={negocio.id}
            nombre={negocio.nombre}
            imagenPortada={negocio.imagen_portada}
            googlePhotoName={negocio.google_photo_name}
            googlePhotoAtribucion={negocio.google_photo_atribucion}
            posicionAtribucion="top-right"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-oliva-900/80 via-oliva-900/20 to-transparent" />

          <div className="relative mx-auto flex h-full max-w-6xl items-end justify-between gap-4 px-6 pb-8 text-white">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-tierra-100">
                {negocio.categoria?.nombre}
                {negocio.zona ? ` · ${negocio.zona}` : ""}
              </p>
              <h1 className="font-display text-3xl font-semibold md:text-4xl">
                {negocio.nombre}
              </h1>
              {puntuacionMedia !== undefined && (
                <p className="mt-1 flex items-center gap-1 text-sm">
                  <Star
                    size={14}
                    aria-hidden="true"
                    className="fill-terracota-400 text-terracota-400"
                  />
                  {puntuacionMedia.toFixed(1)}
                  <span className="text-tierra-200">
                    ({negocio.resenas.length}{" "}
                    {negocio.resenas.length === 1 ? "reseña" : "reseñas"})
                  </span>
                </p>
              )}
            </div>

            <div className="shrink-0">
              <BotonFavorito
                negocioId={negocioId}
                esFavorito={favoritoIds.has(negocioId)}
                rutaActual={`/negocio/${slug}`}
                size={18}
                padding="p-2.5"
              />
            </div>
          </div>

          {/* Curva orgánica que rompe la geometría de la cabecera */}
          <svg
            className="absolute bottom-0 left-0 w-full text-tierra-50"
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M0,32 C240,80 480,0 720,24 C960,48 1200,88 1440,40 L1440,80 L0,80 Z"
            />
          </svg>
        </div>

        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="space-y-8 md:col-span-2">
              {negocio.descripcion && (
                <section>
                  <h2 className="font-display text-xl font-semibold text-oliva-900">
                    Sobre este lugar
                  </h2>
                  <p className="mt-2 whitespace-pre-line text-oliva-700">
                    {negocio.descripcion}
                  </p>
                </section>
              )}

              <section>
                <h2 className="font-display text-xl font-semibold text-oliva-900">
                  Ubicación
                </h2>
                {negocio.lat !== null && negocio.lng !== null ? (
                  <div className="mt-3">
                    <MapaUbicacion
                      puntos={[
                        { nombre: negocio.nombre, lat: negocio.lat, lng: negocio.lng },
                      ]}
                      centro={[negocio.lat, negocio.lng]}
                    />
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-oliva-600">
                    Este negocio aún no tiene ubicación en el mapa.
                  </p>
                )}
              </section>

              <section>
                <h2 className="font-display text-xl font-semibold text-oliva-900">
                  Reseñas
                  {negocio.resenas.length > 0 && ` (${negocio.resenas.length})`}
                </h2>

                {resenasOficiales.length === 0 && resenasUsuarios.length === 0 && (
                  <p className="mt-3 text-sm text-oliva-600">
                    Sé el primero en dejar una reseña.
                  </p>
                )}

                {resenasOficiales.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {resenasOficiales.map((resena) => (
                      <TarjetaResena key={resena.id} resena={resena} />
                    ))}
                  </div>
                )}

                {resenasUsuarios.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {resenasUsuarios.map((resena) => (
                      <TarjetaResena key={resena.id} resena={resena} />
                    ))}
                  </div>
                )}

                <div className="mt-6">
                  {user ? (
                    <form
                      action={crearResena}
                      className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
                    >
                      <p className="text-sm font-medium text-oliva-900">
                        Deja tu reseña
                      </p>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <label key={n} className="cursor-pointer">
                            <input
                              type="radio"
                              name="puntuacion"
                              value={n}
                              defaultChecked={n === 5}
                              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
                              className="peer sr-only"
                              required
                            />
                            <Star
                              size={22}
                              aria-hidden="true"
                              className="text-oliva-400 transition-colors peer-checked:fill-terracota-500 peer-checked:text-terracota-500"
                            />
                          </label>
                        ))}
                      </div>
                      <textarea
                        name="texto"
                        rows={3}
                        placeholder="Cuéntanos tu experiencia (opcional)"
                        className="w-full rounded-xl border border-oliva-100 px-3 py-2 text-sm outline-none focus:border-oliva-400"
                      />
                      <button
                        type="submit"
                        className="rounded-full bg-terracota-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-terracota-600 transition-colors"
                      >
                        Publicar reseña
                      </button>
                    </form>
                  ) : (
                    <div className="rounded-2xl border-2 border-dashed border-oliva-100 bg-tierra-50 px-4 py-6 text-center">
                      <p className="text-sm text-oliva-700">
                        <Link
                          href="/login"
                          className="font-medium text-terracota-600 hover:underline"
                        >
                          Inicia sesión
                        </Link>{" "}
                        para dejar tu reseña.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <aside className="space-y-3 rounded-2xl bg-white p-4 shadow-sm md:h-fit">
              {negocio.direccion && (
                <div className="flex items-start gap-2 text-sm text-oliva-700">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-oliva-400" />
                  <span>{negocio.direccion}</span>
                </div>
              )}

              {negocio.telefono && (
                <div className="flex items-center gap-2 text-sm text-oliva-700">
                  <Phone size={16} className="shrink-0 text-oliva-400" />
                  <a href={`tel:${negocio.telefono}`} className="hover:text-terracota-600">
                    {negocio.telefono}
                  </a>
                </div>
              )}

              {negocio.web && (
                <div className="flex items-center gap-2 text-sm text-oliva-700">
                  <Globe size={16} className="shrink-0 text-oliva-400" />
                  <a
                    href={negocio.web}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:text-terracota-600"
                  >
                    {negocio.web}
                  </a>
                </div>
              )}

              {negocio.horario && Object.keys(negocio.horario).length > 0 && (
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-oliva-900">
                    <Clock size={16} className="text-oliva-400" />
                    Horario
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-oliva-700">
                    {Object.entries(negocio.horario).map(([dia, horas]) => (
                      <li key={dia} className="flex justify-between gap-4">
                        <span className="capitalize">{dia}</span>
                        <span>{horas}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

function TarjetaResena({ resena }: { resena: ResenaRow }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-0.5"
          aria-label={`${resena.puntuacion} de 5 estrellas`}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={14}
              aria-hidden="true"
              className={
                i < resena.puntuacion
                  ? "fill-terracota-500 text-terracota-500"
                  : "text-oliva-400"
              }
            />
          ))}
        </div>
        {resena.es_oficial && (
          <span className="rounded-full bg-oliva-600 px-2 py-0.5 text-xs font-semibold text-white">
            Valoración del equipo
          </span>
        )}
      </div>
      {resena.texto && <p className="mt-2 text-sm text-oliva-700">{resena.texto}</p>}
      <p className="mt-2 text-xs text-oliva-400">
        {new Date(resena.created_at).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
    </div>
  );
}
