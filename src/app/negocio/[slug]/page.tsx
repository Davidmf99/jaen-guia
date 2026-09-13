import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MapPin, Phone, Globe, Clock, Star, Mail, AtSign, Euro, Tag } from "lucide-react";
import MapaUbicacion from "@/components/negocio/MapaUbicacion";
import { createClient } from "@/lib/supabase/server";
import { calcularPuntuacionMedia } from "@/lib/resenas";
import { getUsuarioYFavoritos } from "@/lib/favoritos";
import BotonFavorito from "@/components/BotonFavorito";
import ImagenNegocio from "@/components/ImagenNegocio";
import SelectorEstrellas from "@/components/negocio/SelectorEstrellas";
import ComoLlegar from "@/components/ComoLlegar";
import BotonSubmitResena from "@/components/negocio/BotonSubmitResena";
import OverlayFormulario from "@/components/negocio/OverlayFormulario";
import GestionarNegocio from "@/components/negocio/GestionarNegocio";
import { gradientePara } from "@/lib/gradiente";
import { SERVICIOS, etiquetaRangoPrecio } from "@/lib/servicios";
import { horarioOrdenado, estaAbierto, proximoCambio } from "@/lib/horario";
import { esNegocio as clasificarNegocio, muestraHorario } from "@/lib/categorias";
import type { Categoria } from "@/types";

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

interface ResenaRow {
  id: string;
  puntuacion: number;
  texto: string | null;
  es_oficial: boolean;
  created_at: string;
  usuario_id: string;
  perfil?: {
    nombre: string | null;
    apellidos: string | null;
    username: string | null;
  } | null;
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
  rango_precio: string | null;
  tipo_cocina: string[];
  especialidades: string[];
  servicios: string[];
  email: string | null;
  instagram: string | null;
  categoria: { nombre: string; tipo: Categoria["tipo"] } | null;
  resenas: ResenaRow[];
}

// cache() deduplica la consulta entre generateMetadata y el propio Page,
// que en Next se ejecutan por separado para la misma petición.
const getNegocio = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("negocios")
    .select(
      "id, nombre, slug, descripcion, descripcion_corta, direccion, zona, lat, lng, telefono, web, horario, imagen_portada, google_photo_name, google_photo_atribucion, rango_precio, tipo_cocina, especialidades, servicios, email, instagram, categoria:categorias(nombre, tipo), resenas(id, puntuacion, texto, es_oficial, created_at, usuario_id, perfil:perfiles(nombre, apellidos, username))"
    )
    .eq("slug", slug)
    .single()
    .returns<NegocioFichaRow>();

  if (error || !data) return null;
  return data;
});

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ solicitud?: string }>;
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

export default async function NegocioPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { solicitud } = await searchParams;
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

  const miResena = user ? resenasUsuarios.find((r) => r.usuario_id === user.id) : null;

  const servicios = SERVICIOS.filter((s) => negocio.servicios.includes(s.clave));
  const etiquetaPrecio = etiquetaRangoPrecio(negocio.rango_precio);
  const tieneDetalles = Boolean(etiquetaPrecio) || negocio.tipo_cocina.length > 0;
  // Un parque o un monumento no está "abierto" ni tiene dueño que lo reclame.
  const esNegocio = clasificarNegocio(negocio);
  const horario = muestraHorario(negocio.categoria?.tipo) ? horarioOrdenado(negocio.horario) : [];
  const abierto = esNegocio ? estaAbierto(negocio.horario) : null;
  const cambio = esNegocio ? proximoCambio(negocio.horario) : null;

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

    await supabase.from("resenas").upsert({
      negocio_id: negocioId,
      usuario_id: user.id,
      puntuacion,
      texto,
      es_oficial: false,
    }, { onConflict: "negocio_id,usuario_id" });

    revalidatePath(`/negocio/${slug}`);
    revalidatePath("/mis-resenas");
  }

  async function eliminarResena() {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from("resenas").delete().match({ negocio_id: negocioId, usuario_id: user.id });
    revalidatePath(`/negocio/${slug}`);
    revalidatePath("/mis-resenas");
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

              {(tieneDetalles || servicios.length > 0) && (
                <section>
                  <h2 className="font-sans text-sm font-bold uppercase tracking-[0.2em] text-terracota-600 mb-6">
                    Lo que encontrarás
                  </h2>

                  {tieneDetalles && (
                    <div className="mb-8 flex flex-wrap items-center gap-2">
                      {etiquetaPrecio && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-oliva-900 px-3.5 py-1.5 text-sm font-bold text-white">
                          <Euro size={14} aria-hidden="true" />
                          {negocio.rango_precio}
                          <span className="font-medium text-white/70">· {etiquetaPrecio}</span>
                        </span>
                      )}
                      {negocio.tipo_cocina.map((tipo) => (
                        <span
                          key={tipo}
                          className="inline-flex items-center gap-1.5 rounded-full border border-oliva-100 bg-white px-3.5 py-1.5 text-sm font-semibold text-oliva-900"
                        >
                          <Tag size={14} aria-hidden="true" className="text-terracota-500" />
                          {tipo}
                        </span>
                      ))}
                    </div>
                  )}

                  {negocio.especialidades.length > 0 && (
                    <div className="mb-8">
                      <p className="mb-3 font-bold text-oliva-900">No te vayas sin probar</p>
                      <ul className="flex flex-wrap gap-2">
                        {negocio.especialidades.map((plato) => (
                          <li
                            key={plato}
                            className="rounded-2xl bg-tierra-100 px-4 py-2 text-base font-medium text-terracota-700"
                          >
                            {plato}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {servicios.length > 0 && (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {servicios.map(({ clave, etiqueta, icono: Icono }) => (
                        <li
                          key={clave}
                          className="flex items-center gap-3 rounded-2xl border border-oliva-100 bg-white px-4 py-3 text-oliva-900"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tierra-50 text-oliva-600">
                            <Icono size={18} strokeWidth={1.5} aria-hidden="true" />
                          </span>
                          <span className="font-medium">{etiqueta}</span>
                        </li>
                      ))}
                    </ul>
                  )}
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

              <section id="resenas" className="scroll-mt-24">
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
                      <TarjetaResena
                        key={resena.id}
                        resena={resena}
                        esMia={resena.usuario_id === user?.id}
                        eliminar={eliminarResena}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-10">
                  {user ? (
                    <form
                      id="editar-resena"
                      action={crearResena}
                      className="relative scroll-mt-24 rounded-[2rem] bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-oliva-100"
                    >
                      <OverlayFormulario>
                        <div className="mb-6 flex items-start justify-between gap-4">
                          <h3 className="text-xl font-bold text-oliva-900">
                            {miResena ? "Edita tu reseña" : "Deja tu reseña"}
                          </h3>
                          {miResena && (
                            <button
                              type="submit"
                              formAction={eliminarResena}
                              className="text-sm font-semibold text-terracota-500 hover:text-terracota-700 hover:underline"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                        <SelectorEstrellas inicial={miResena?.puntuacion ?? 5} />

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
                          defaultValue={miResena?.texto ?? ""}
                          placeholder="Cuéntanos tu experiencia"
                          className="mb-6 w-full rounded-2xl border border-oliva-100 bg-tierra-50 p-4 text-base outline-none focus:border-terracota-400 focus:bg-white transition-all resize-none"
                        />
                        <BotonSubmitResena texto={miResena ? "Guardar cambios" : "Publicar reseña"} />
                      </OverlayFormulario>
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

                {negocio.email && (
                  <div className="flex items-center gap-4 text-oliva-700">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tierra-50 text-oliva-600">
                      <Mail size={20} strokeWidth={1.5} />
                    </div>
                    <a href={`mailto:${negocio.email}`} className="truncate font-medium hover:text-terracota-600 transition-colors">
                      {negocio.email}
                    </a>
                  </div>
                )}

                {negocio.instagram && (
                  <div className="flex items-center gap-4 text-oliva-700">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tierra-50 text-oliva-600">
                      <AtSign size={20} strokeWidth={1.5} />
                    </div>
                    <a
                      href={`https://instagram.com/${negocio.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate font-medium hover:text-terracota-600 transition-colors"
                    >
                      @{negocio.instagram}
                    </a>
                  </div>
                )}

                {horario.length > 0 && (
                  <div className="pt-6 border-t border-oliva-100/50 mt-6">
                    <p className="flex items-center gap-3 font-bold text-oliva-900 mb-2">
                      <Clock size={20} strokeWidth={1.5} className="text-terracota-500" />
                      Horario de apertura
                    </p>
                    {abierto !== null && (
                      <p className="mb-4 flex items-center gap-2 text-base font-semibold">
                        <span
                          aria-hidden="true"
                          className={`h-2.5 w-2.5 rounded-full ${abierto ? "bg-green-600" : "bg-oliva-200"}`}
                        />
                        <span className={abierto ? "text-oliva-900" : "text-oliva-600"}>
                          {abierto ? "Abierto ahora" : "Cerrado ahora"}
                        </span>
                        {cambio && <span className="font-medium text-oliva-600">· {cambio}</span>}
                      </p>
                    )}
                    <ul className="space-y-3 text-base font-medium text-oliva-700">
                      {horario.map(({ clave, etiqueta, horas }) => (
                        <li key={clave} className="flex justify-between gap-4">
                          <span className="opacity-80">{etiqueta}</span>
                          <span className="text-oliva-900">{horas}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </aside>

          </div>

          {esNegocio && (
            <div className="mt-16">
              <GestionarNegocio
                negocioId={negocioId}
                slug={slug}
                nombre={negocio.nombre}
                usuarioId={user?.id ?? null}
                aviso={solicitud}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function TarjetaResena({
  resena,
  esMia = false,
  eliminar,
}: {
  resena: ResenaRow;
  /** Si es del usuario logueado, la tarjeta lleva Editar / Eliminar. */
  esMia?: boolean;
  eliminar?: () => Promise<void>;
}) {
  const nombreCompleto = [resena.perfil?.nombre, resena.perfil?.apellidos].filter(Boolean).join(" ");
  const nombreMostrar = nombreCompleto || resena.perfil?.username || "Anónimo";
  const inicialesAvatar = iniciales(nombreMostrar);
  const gradiente = gradientePara(nombreMostrar);

  return (
    <div className="rounded-2xl border border-oliva-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradiente} shadow-inner`}>
            <span className="font-display text-sm font-bold text-white/90">
              {inicialesAvatar}
            </span>
          </div>
          <div>
            <p className="font-bold text-oliva-900">{nombreMostrar}</p>
            {resena.perfil?.username && (
              <p className="text-xs font-medium text-terracota-600">@{resena.perfil.username}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div
            className="flex items-center gap-1"
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
                    : "text-oliva-100"
                }
              />
            ))}
          </div>
          {resena.es_oficial && (
            <span className="rounded-full bg-oliva-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Nota editorial
            </span>
          )}
        </div>
      </div>
      {resena.texto && <p className="text-base font-medium leading-relaxed text-oliva-900 mb-3">{resena.texto}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-oliva-600 uppercase tracking-wide">
          {new Date(resena.created_at).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        {esMia && eliminar && (
          <div className="flex items-center gap-4 text-sm font-semibold">
            <a href="#editar-resena" className="text-oliva-900 hover:text-terracota-600 hover:underline">
              Editar
            </a>
            <form action={eliminar}>
              <button type="submit" className="text-terracota-500 hover:text-terracota-700 hover:underline">
                Eliminar
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
