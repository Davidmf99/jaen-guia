import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";
import EventosNegocio, { type EventoPanel } from "@/components/panel/EventosNegocio";
import BorradoresWhatsApp, { type BorradorPanel } from "@/components/panel/BorradoresWhatsApp";
import ConexionFacebook, { type ConexionPanel } from "@/components/panel/ConexionFacebook";
import { facebookConfigurado } from "@/lib/facebook";
import PlanDestacado from "@/components/panel/PlanDestacado";
import { stripeConfigurado } from "@/lib/stripe";
import CampoPortada from "@/components/panel/CampoPortada";
import { createClient } from "@/lib/supabase/server";
import { filtroEventosVigentes } from "@/lib/eventos";
import { SERVICIOS, RANGOS_PRECIO, parsearLista } from "@/lib/servicios";
import { DIAS_SEMANA, normalizarHorario } from "@/lib/horario";

export const metadata: Metadata = {
  title: "Editar negocio · Jaén Guía",
  description: "Gestiona la ficha pública de tu negocio en Jaén Guía.",
};

// Bucket de Supabase Storage donde se suben las portadas desde este
// panel. Todavía NO existe en el proyecto — hay que crearlo a mano
// (bucket público "negocios-portadas" + políticas de storage.objects
// para que solo el dueño pueda subir a su propia carpeta) antes de que
// la subida de imagen funcione. Ver aviso aparte.

const BUCKET_PORTADAS = "negocios-portadas";

// Tope de la portada ya en el servidor. Tiene que quedar por debajo del
// bodySizeLimit de next.config.ts (4 MB) y del límite de 4,5 MB por
// petición de las funciones de Vercel; CampoPortada reduce la foto en el
// navegador para no acercarse a esto.
const PORTADA_MAX_MB = 3.5;
const PORTADA_MAX_BYTES = PORTADA_MAX_MB * 1024 * 1024;

const DIAS = DIAS_SEMANA;

interface NegocioPanel {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  categoria_id: string | null;
  telefono: string | null;
  web: string | null;
  horario: Record<string, string> | null;
  imagen_portada: string | null;
  rango_precio: string | null;
  tipo_cocina: string[];
  especialidades: string[];
  servicios: string[];
  email: string | null;
  instagram: string | null;
  plan: string;
  facebook: string | null;
  miembros: { estado: string }[];
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function PanelNegocioPage({ params, searchParams }: PageProps) {
  const { slug: slugParam } = await params;
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?volver=${encodeURIComponent(`/panel/${slugParam}`)}`);

  // Quién puede editar lo decide negocios_miembros (migración 0011), no
  // perfiles.rol. La membresía se comprueba aquí para dar un 404 en vez
  // de un formulario que luego no guarda nada; la RLS de negocios
  // ("Miembro edita su negocio") es la protección real.
  const { data: negocio } = await supabase
    .from("negocios")
    .select(
      "id, slug, nombre, descripcion, direccion, categoria_id, telefono, web, horario, imagen_portada, rango_precio, tipo_cocina, especialidades, servicios, email, instagram, facebook, plan, miembros:negocios_miembros!inner(estado)"
    )
    .eq("slug", slugParam)
    .eq("miembros.perfil_id", user.id)
    .eq("miembros.estado", "aprobado")
    .maybeSingle()
    .returns<NegocioPanel>();

  if (!negocio) notFound();

  // /panel redirige aquí cuando el usuario solo tiene este negocio, así
  // que el enlace "Mis negocios" sería un bucle: solo se enseña si hay
  // algo más que listar (otro negocio o una solicitud pendiente).
  const { count: numMembresias } = await supabase
    .from("negocios_miembros")
    .select("negocio_id", { count: "exact", head: true })
    .eq("perfil_id", user.id);
  const tieneVariosNegocios = (numMembresias ?? 0) > 1;

  // Claves sin tilde: los horarios importados de Google traen
  // "miércoles"/"sábado" y el formulario usa "miercoles"/"sabado".
  const horarioActual = normalizarHorario(negocio.horario);

  // Las mismas secciones que usa la navegación del sitio, para que un
  // evento de un bar caiga en "Gastronomía" y no en un catálogo aparte.
  const { data: categorias } = await supabase
    .from("categorias")
    .select("id, nombre")
    .order("orden")
    .returns<{ id: string; nombre: string }[]>();

  const { data: eventos } = await supabase
    .from("eventos")
    .select("id, slug, titulo, fecha_inicio, es_todo_el_dia, lugar_nombre, promocionado_hasta")
    .eq("negocio_id", negocio.id)
    .eq("origen", "negocio")
    .or(filtroEventosVigentes())
    .order("fecha_inicio", { ascending: true })
    .returns<EventoPanel[]>();

  // Borradores que llegaron por WhatsApp, Facebook o Instagram
  // (migraciones 0013/0014): esperan a que el dueño los confirme. La
  // RLS "Dueño ve sus eventos en borrador" es la que los deja ver.
  const { data: borradores } = await supabase
    .from("eventos")
    .select("id, titulo, descripcion, imagen, fecha_inicio, es_todo_el_dia, es_gratis, precio_texto, origen, fuente_url, created_at")
    .eq("negocio_id", negocio.id)
    .in("origen", ["whatsapp", "facebook", "instagram"])
    .eq("estado", "borrador")
    .order("created_at", { ascending: false })
    .returns<BorradorPanel[]>();

  // Columnas explícitas: page_token_cifrado tiene el SELECT revocado
  // para authenticated y un "*" fallaría entero.
  const { data: conexion } = await supabase
    .from("negocios_conexiones")
    .select("page_id, page_nombre, ig_username, ultima_sync, ultimo_error")
    .eq("negocio_id", negocio.id)
    .eq("plataforma", "facebook")
    .maybeSingle<ConexionPanel>();

  async function actualizarNegocio(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const negocioId = String(formData.get("negocio_id") ?? "");
    const slug = String(formData.get("slug") ?? "");
    if (!negocioId) return;

    const horario: Record<string, string> = {};
    for (const dia of DIAS) {
      const valor = String(formData.get(`horario_${dia.clave}`) ?? "").trim();
      if (valor) horario[dia.clave] = valor;
    }

    const cambios: Record<string, unknown> = {
      nombre: String(formData.get("nombre") ?? "").trim(),
      descripcion: String(formData.get("descripcion") ?? "").trim() || null,
      telefono: String(formData.get("telefono") ?? "").trim() || null,
      web: String(formData.get("web") ?? "").trim() || null,
      horario: Object.keys(horario).length > 0 ? horario : null,
      email: String(formData.get("email") ?? "").trim() || null,
      // Se acepta "@usuario" o la URL entera y se guarda solo el usuario.
      instagram:
        String(formData.get("instagram") ?? "")
          .trim()
          .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
          .replace(/^@/, "")
          .replace(/\/.*$/, "") || null,
      // URL o nombre de la página; lo normaliza el cron de redes públicas.
      facebook: String(formData.get("facebook") ?? "").trim() || null,
      rango_precio: RANGOS_PRECIO.some((r) => r.valor === formData.get("rango_precio"))
        ? String(formData.get("rango_precio"))
        : null,
      tipo_cocina: parsearLista(formData.get("tipo_cocina")),
      especialidades: parsearLista(formData.get("especialidades")),
      servicios: formData
        .getAll("servicios")
        .map(String)
        .filter((clave) => SERVICIOS.some((s) => s.clave === clave)),
    };

    const volver = (tipo: "ok" | "error", mensaje: string): never =>
      redirect(`/panel/${slug}?${tipo}=${encodeURIComponent(mensaje)}`);

    const portada = formData.get("portada");
    if (portada instanceof File && portada.size > 0) {
      // CampoPortada ya la reduce en el navegador; esto es la red de
      // seguridad por si llega sin JavaScript o el navegador no pudo.
      if (!portada.type.startsWith("image/")) {
        volver("error", "El archivo de portada tiene que ser una imagen.");
      }
      if (portada.size > PORTADA_MAX_BYTES) {
        volver(
          "error",
          `La foto pesa ${(portada.size / 1024 / 1024).toFixed(1)} MB y el máximo son ${PORTADA_MAX_MB} MB. Prueba con una más pequeña.`
        );
      }

      const extension = portada.name.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? ".jpg";
      const ruta = `${negocioId}/${Date.now()}${extension}`;
      // Sin upsert: la ruta lleva timestamp y nunca colisiona, y con
      // `upsert: true` Storage necesita además una policy de SELECT
      // sobre storage.objects (que no hay: el bucket es público y se lee
      // por URL) y falla con "new row violates row-level security".
      const { error: errorSubida } = await supabase.storage
        .from(BUCKET_PORTADAS)
        .upload(ruta, portada, { contentType: portada.type });

      if (errorSubida) {
        // Antes se ignoraba en silencio y el dueño no sabía por qué la
        // foto no cambiaba.
        volver("error", `No hemos podido subir la foto (${errorSubida.message}). El resto de cambios no se ha guardado.`);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET_PORTADAS).getPublicUrl(ruta);
      cambios.imagen_portada = publicUrl;
    }

    // La RLS de negocios ("Miembro edita su negocio", migración 0011) es
    // la que realmente protege esto: si el usuario no fuera miembro
    // aprobado, el update afectaría a 0 filas.
    const { error: errorUpdate } = await supabase
      .from("negocios")
      .update(cambios)
      .eq("id", negocioId);

    if (errorUpdate) volver("error", "No hemos podido guardar los cambios. Inténtalo de nuevo.");

    revalidatePath("/panel");
    if (slug) {
      revalidatePath(`/panel/${slug}`);
      revalidatePath(`/negocio/${slug}`);
    }
    volver("ok", "Cambios guardados.");
  }

  const numeroWhatsApp = process.env.NEXT_PUBLIC_WHATSAPP_NUMERO ?? null;

  return (
    <>
      <main className="mx-auto max-w-2xl px-6 py-10">
        {tieneVariosNegocios && (
          <Link
            href="/panel"
            className="mb-6 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-oliva-700 hover:text-terracota-600 transition-colors"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Mis negocios
          </Link>
        )}
        <header className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-oliva-900">
            {negocio.nombre}
          </h1>
          <p className="mt-2 text-oliva-700">
            Edita la ficha pública de tu negocio.{" "}
            <Link href={`/negocio/${negocio.slug}`} className="font-semibold text-terracota-600 hover:underline">
              Ver ficha
            </Link>
          </p>
        </header>

        {(ok || error) && (
          <p
            role="status"
            className={`mb-6 rounded-2xl px-4 py-3 text-base font-semibold ${
              error
                ? "bg-terracota-500/10 text-terracota-600"
                : "bg-oliva-100 text-oliva-900"
            }`}
          >
            {error ?? ok}
          </p>
        )}

        <form
          action={actualizarNegocio}
          className="space-y-5 rounded-2xl bg-white p-6 shadow-sm"
        >
          <input type="hidden" name="negocio_id" value={negocio.id} />
          <input type="hidden" name="slug" value={negocio.slug} />

          <div>
            <label htmlFor="nombre" className="block text-base font-medium text-oliva-700">
              Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              defaultValue={negocio.nombre}
              required
              className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
            />
          </div>

          <div>
            <label htmlFor="descripcion" className="block text-base font-medium text-oliva-700">
              Descripción
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              rows={4}
              defaultValue={negocio.descripcion ?? ""}
              className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="telefono" className="block text-base font-medium text-oliva-700">
                Teléfono
              </label>
              <input
                id="telefono"
                name="telefono"
                type="tel"
                defaultValue={negocio.telefono ?? ""}
                className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
              />
            </div>
            <div>
              <label htmlFor="web" className="block text-base font-medium text-oliva-700">
                Web
              </label>
              <input
                id="web"
                name="web"
                type="url"
                placeholder="https://"
                defaultValue={negocio.web ?? ""}
                className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="block text-base font-medium text-oliva-700">
                Email de contacto
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={negocio.email ?? ""}
                className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
              />
            </div>
            <div>
              <label htmlFor="instagram" className="block text-base font-medium text-oliva-700">
                Instagram
              </label>
              <input
                id="instagram"
                name="instagram"
                type="text"
                placeholder="@tunegocio"
                defaultValue={negocio.instagram ?? ""}
                aria-describedby="instagram-ayuda"
                className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
              />
              {/* Las stories no tienen API: el tip empuja a post/reel y
                  deja WhatsApp como red de seguridad. */}
              <p id="instagram-ayuda" className="mt-1 text-sm text-oliva-600">
                💡 Si publicas tu evento como foto o reel (no solo en una story), aparece
                automáticamente en Jaén Guía. Si alguna vez solo lo subes a una story,
                reenvíanos el cartel{" "}
                {numeroWhatsApp ? (
                  <>
                    a{" "}
                    <a href={`https://wa.me/${numeroWhatsApp.replace(/\D/g, "")}`} className="font-medium text-terracota-600 hover:underline">
                      +{numeroWhatsApp.replace(/\D/g, "")}
                    </a>
                  </>
                ) : (
                  "por WhatsApp"
                )}{" "}
                y lo publicamos igual.
              </p>
            </div>
            <div>
              <label htmlFor="facebook" className="block text-base font-medium text-oliva-700">
                Facebook
              </label>
              <input
                id="facebook"
                name="facebook"
                type="text"
                placeholder="facebook.com/tunegocio"
                defaultValue={negocio.facebook ?? ""}
                className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rango_precio" className="block text-base font-medium text-oliva-700">
                Precio orientativo
              </label>
              <select
                id="rango_precio"
                name="rango_precio"
                defaultValue={negocio.rango_precio ?? ""}
                className="mt-1 w-full rounded-xl border border-oliva-100 bg-white px-3 py-2.5 text-base outline-none focus:border-oliva-400"
              >
                <option value="">Sin indicar</option>
                {RANGOS_PRECIO.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.valor} · {r.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tipo_cocina" className="block text-base font-medium text-oliva-700">
                Tipo de cocina o de negocio
              </label>
              <input
                id="tipo_cocina"
                name="tipo_cocina"
                type="text"
                placeholder="Tapas, Cocina jiennense, Asador"
                defaultValue={negocio.tipo_cocina.join(", ")}
                aria-describedby="tipo_cocina-ayuda"
                className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
              />
              <p id="tipo_cocina-ayuda" className="mt-1 text-sm text-oliva-600">
                Separa cada etiqueta con una coma.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="especialidades" className="block text-base font-medium text-oliva-700">
              Especialidades o productos estrella
            </label>
            <textarea
              id="especialidades"
              name="especialidades"
              rows={3}
              placeholder={"Ochíos con morcilla\nAndrajos\nPipirrana"}
              defaultValue={negocio.especialidades.join("\n")}
              aria-describedby="especialidades-ayuda"
              className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
            />
            <p id="especialidades-ayuda" className="mt-1 text-sm text-oliva-600">
              Uno por línea. Aparecen en la ficha como «No te vayas sin probar».
            </p>
          </div>

          <fieldset>
            <legend className="text-base font-medium text-oliva-700">Servicios</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SERVICIOS.map(({ clave, etiqueta }) => (
                <label
                  key={clave}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-oliva-100 px-3 text-base text-oliva-900 has-[:checked]:border-oliva-400 has-[:checked]:bg-tierra-50"
                >
                  <input
                    type="checkbox"
                    name="servicios"
                    value={clave}
                    defaultChecked={negocio.servicios.includes(clave)}
                    className="h-4 w-4 accent-terracota-600"
                  />
                  {etiqueta}
                </label>
              ))}
            </div>
          </fieldset>

          {/* fieldset/legend y no un <p>: es un grupo de campos, y así
              un lector de pantalla anuncia "Horario" al entrar en él. */}
          <fieldset>
            <legend className="text-base font-medium text-oliva-700">
              Horario
            </legend>
            <div className="mt-2 space-y-2">
              {DIAS.map((dia) => (
                <div key={dia.clave} className="flex items-center gap-3">
                  <label
                    htmlFor={`horario_${dia.clave}`}
                    className="w-24 shrink-0 text-base text-oliva-700"
                  >
                    {dia.etiqueta}
                  </label>
                  <input
                    id={`horario_${dia.clave}`}
                    name={`horario_${dia.clave}`}
                    type="text"
                    placeholder="9:00-14:00, 17:00-21:00 (vacío = cerrado)"
                    defaultValue={horarioActual[dia.clave] ?? ""}
                    className="flex-1 rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <CampoPortada imagenActual={negocio.imagen_portada} />

          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-full bg-terracota-600 px-5 text-base font-semibold text-white hover:bg-terracota-700 transition-colors"
          >
            Guardar cambios
          </button>
        </form>

        <ConexionFacebook
          negocioId={negocio.id}
          slugNegocio={negocio.slug}
          conexion={conexion ?? null}
          disponible={facebookConfigurado()}
        />

        <BorradoresWhatsApp
          slugNegocio={negocio.slug}
          borradores={borradores ?? []}
          numeroWhatsApp={numeroWhatsApp}
        />

        <PlanDestacado
          negocioId={negocio.id}
          slugNegocio={negocio.slug}
          plan={negocio.plan}
          disponible={stripeConfigurado()}
        />

        <EventosNegocio
          negocio={negocio}
          categorias={categorias ?? []}
          eventos={eventos ?? []}
          pagosDisponibles={stripeConfigurado()}
        />
      </main>
    </>
  );
}
