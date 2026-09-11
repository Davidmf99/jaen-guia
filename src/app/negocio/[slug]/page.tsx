import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MapPin, Phone, Globe, Clock, Star } from "lucide-react";
import MapaUbicacion from "@/components/negocio/MapaUbicacion";
import { createClient } from "@/lib/supabase/server";
import { calcularPuntuacionMedia } from "@/lib/resenas";
import { getUsuarioYFavoritos } from "@/lib/favoritos";
import BotonFavorito from "@/components/BotonFavorito";
import ImagenNegocio from "@/components/ImagenNegocio";
import SelectorEstrellas from "@/components/negocio/SelectorEstrellas";
import ComoLlegar from "@/components/ComoLlegar";

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
      <main className="min-h-screen bg-tierra-50 pb-24">
        {/* Cabecera hero: En lugar de un SVG curve feo, usamos un Bento block flotante */}
        <div className="mx-auto max-w-6xl px-6 pt-10">
          <div className="relative h-72 w-full overflow-hidden rounded-[2.5rem] shadow-xl md:h-[450px]">
            <ImagenNegocio
              negocioId={negocio.id}
              nombre={negocio.nombre}
              imagenPortada={negocio.imagen_portada}
              googlePhotoName={negocio.google_photo_name}
              googlePhotoAtribucion={negocio.google_photo_atribucion}
              posicionAtribucion="top-right"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-oliva-900/90 via-oliva-900/20 to-transparent" />

            <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 text-white flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="max-w-3xl">
                <span className="mb-3 inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-bold uppercase tracking-widest backdrop-blur-md">
                  {negocio.categoria?.nombre}
                  {negocio.zona ? ` · ${negocio.zona}` : ""}
                </span>
                <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight md:text-6xl mb-4">
                  {negocio.nombre}
                </h1>
                {puntuacionMedia !== undefined && (
                  <div className="flex items-center gap-2 text-sm md:text-base font-medium">
                    <div className="flex items-center gap-1 rounded-full bg-terracota-500/20 px-3 py-1 backdrop-blur-md border border-terracota-500/30">
                      <Star
                        size={16}
                        aria-hidden="true"
                        className="fill-terracota-500 text-terracota-500"
                      />
                      <span className="text-white font-bold">{puntuacionMedia.toFixed(1)}</span>
                    </div>
                    <span className="text-white/80">
                      ({negocio.resenas.length}{" "}
                      {negocio.resenas.length === 1 ? "reseña" : "reseñas"})
                    </span>
                  </div>
                )}
              </div>

              <div className="shrink-0">
                <BotonFavorito
                  negocioId={negocioId}
                  esFavorito={favoritoIds.has(negocioId)}
                  rutaActual={`/negocio/${slug}`}
                  tamano="ficha"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            
            {/* Columna Izquierda: Información */}
            <div className="space-y-16 lg:col-span-8">
              {negocio.descripcion && (
                <section>
                  <h2 className="font-sans text-sm font-bold uppercase tracking-[0.2em] text-terracota-600 mb-6">
                    Sobre este lugar
                  </h2>
                  <p className="whitespace-pre-line text-lg leading-relaxed text-oliva-700">
                    {negocio.descripcion}
                  </p>
                </section>
              )}

              <section>
                <h2 className="font-sans text-sm font-bold uppercase tracking-[0.2em] text-terracota-600 mb-6">
                  Ubicación
                </h2>
                {negocio.lat !== null && negocio.lng !== null ? (
                  <div className="overflow-hidden rounded-[2rem] border border-oliva-100 shadow-sm">
                    <MapaUbicacion
                      puntos={[
                        { nombre: negocio.nombre, lat: negocio.lat, lng: negocio.lng },
                      ]}
                      centro={[negocio.lat, negocio.lng]}
                    />
                  </div>
                ) : (
                  <p className="text-oliva-600">
                    Este negocio aún no tiene ubicación en el mapa.
                  </p>
                )}

                {/* En táctil el mapa no se arrastra (ver MapaLeaflet), así
                    que este botón es la única forma real de pasar de "dónde
                    está" a "llévame". */}
                <div className="mt-5">
                  <ComoLlegar
                    nombre={negocio.nombre}
                    direccion={negocio.direccion}
                    lat={negocio.lat}
                    lng={negocio.lng}
                  />
                </div>
              </section>

              <section>
                <h2 className="font-sans text-sm font-bold uppercase tracking-[0.2em] text-terracota-600 mb-6 flex items-center gap-2">
                  Reseñas
                  {negocio.resenas.length > 0 && <span className="flex items-center justify-center h-6 w-6 rounded-full bg-oliva-100 text-sm font-bold text-oliva-900">{negocio.resenas.length}</span>}
                </h2>

                {resenasOficiales.length === 0 && resenasUsuarios.length === 0 && (
                  <p className="text-oliva-600 italic">
                    Sé el primero en dejar una reseña.
                  </p>
                )}

                {resenasOficiales.length > 0 && (
                  <div className="space-y-4">
                    {resenasOficiales.map((resena) => (
                      <TarjetaResena key={resena.id} resena={resena} />
                    ))}
                  </div>
                )}

                {resenasUsuarios.length > 0 && (
                  <div className="mt-6 space-y-4">
                    {resenasUsuarios.map((resena) => (
                      <TarjetaResena key={resena.id} resena={resena} />
                    ))}
                  </div>
                )}

                <div className="mt-10">
                  {user ? (
                    <form
                      action={crearResena}
                      className="rounded-[2rem] bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-oliva-100"
                    >
                      <h3 className="text-xl font-bold text-oliva-900 mb-6">
                        Deja tu reseña
                      </h3>
                      <SelectorEstrellas />

                      <label
                        htmlFor="texto"
                        className="mb-2 block text-base font-semibold text-oliva-900"
                      >
                        Tu comentario{" "}
                        <span className="font-normal text-oliva-600">
                          (opcional)
                        </span>
                      </label>
                      <textarea
                        id="texto"
                        name="texto"
                        rows={4}
                        placeholder="Cuéntanos tu experiencia"
                        className="mb-6 w-full rounded-2xl border border-oliva-100 bg-tierra-50 p-4 text-base outline-none focus:border-terracota-400 focus:bg-white transition-all resize-none"
                      />
                      <button
                        type="submit"
                        className="rounded-full bg-oliva-900 px-8 py-3.5 font-bold text-white hover:bg-terracota-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Publicar reseña
                      </button>
                    </form>
                  ) : (
                    <div className="rounded-[2rem] border-2 border-dashed border-oliva-100 bg-white p-8 text-center">
                      <p className="text-oliva-700 font-medium">
                        <Link
                          href="/login"
                          className="font-bold text-terracota-600 hover:text-terracota-700 transition-colors"
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

            {/* Columna Derecha: Tarjeta de Info Bento */}
            <aside className="lg:col-span-4">
              <div className="sticky top-24 space-y-6 rounded-[2rem] bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-oliva-100">
                <h3 className="font-sans text-sm font-bold uppercase tracking-[0.2em] text-terracota-600 mb-6">
                  Información
                </h3>

                {negocio.direccion && (
                  <div className="flex items-start gap-4 text-oliva-700">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tierra-50 text-oliva-600">
                      <MapPin size={20} strokeWidth={1.5} />
                    </div>
                    <span className="pt-2 font-medium leading-tight">{negocio.direccion}</span>
                  </div>
                )}

                <ComoLlegar
                  nombre={negocio.nombre}
                  direccion={negocio.direccion}
                  lat={negocio.lat}
                  lng={negocio.lng}
                  variante="discreta"
                />

                {negocio.telefono && (
                  <div className="flex items-center gap-4 text-oliva-700">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tierra-50 text-oliva-600">
                      <Phone size={20} strokeWidth={1.5} />
                    </div>
                    <a href={`tel:${negocio.telefono}`} className="font-medium hover:text-terracota-600 transition-colors">
                      {negocio.telefono}
                    </a>
                  </div>
                )}

                {negocio.web && (
                  <div className="flex items-center gap-4 text-oliva-700">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tierra-50 text-oliva-600">
                      <Globe size={20} strokeWidth={1.5} />
                    </div>
                    <a
                      href={negocio.web}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-medium hover:text-terracota-600 transition-colors"
                    >
                      {negocio.web.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
                    </a>
                  </div>
                )}

                {negocio.horario && Object.keys(negocio.horario).length > 0 && (
                  <div className="pt-6 border-t border-oliva-100/50 mt-6">
                    <p className="flex items-center gap-3 font-bold text-oliva-900 mb-4">
                      <Clock size={20} strokeWidth={1.5} className="text-terracota-500" />
                      Horario de apertura
                    </p>
                    <ul className="space-y-3 text-base font-medium text-oliva-700">
                      {Object.entries(negocio.horario).map(([dia, horas]) => (
                        <li key={dia} className="flex justify-between gap-4">
                          <span className="capitalize opacity-80">{dia}</span>
                          <span className="text-oliva-900">{horas}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </aside>

          </div>
        </div>
      </main>
    </>
  );
}

function TarjetaResena({ resena }: { resena: ResenaRow }) {
  return (
    <div className="rounded-2xl border border-oliva-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div
          className="flex items-center gap-1"
          aria-label={`${resena.puntuacion} de 5 estrellas`}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={16}
              aria-hidden="true"
              className={
                i < resena.puntuacion
                  ? "fill-terracota-500 text-terracota-500"
                  : "text-oliva-100"
              }
            />
          ))}
        </div>
        {resena.es_oficial && (
          <span className="rounded-full bg-oliva-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
            Nota editorial
          </span>
        )}
      </div>
      {resena.texto && <p className="text-base font-medium leading-relaxed text-oliva-900 mb-3">{resena.texto}</p>}
      <p className="text-sm font-semibold text-oliva-600 uppercase tracking-wide">
        {new Date(resena.created_at).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
    </div>
  );
}
