import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import EstadoVacio from "@/components/home/EstadoVacio";
import EventosNegocio, { type EventoPanel } from "@/components/panel/EventosNegocio";
import { createClient } from "@/lib/supabase/server";
import { filtroEventosVigentes } from "@/lib/eventos";

export const metadata: Metadata = {
  title: "Panel de negocio · Jaén Guía",
  description: "Gestiona la ficha pública de tu negocio en Jaén Guía.",
};

// Bucket de Supabase Storage donde se suben las portadas desde este
// panel. Todavía NO existe en el proyecto — hay que crearlo a mano
// (bucket público "negocios-portadas" + políticas de storage.objects
// para que solo el dueño pueda subir a su propia carpeta) antes de que
// la subida de imagen funcione. Ver aviso aparte.
const BUCKET_PORTADAS = "negocios-portadas";

const DIAS = [
  { clave: "lunes", etiqueta: "Lunes" },
  { clave: "martes", etiqueta: "Martes" },
  { clave: "miercoles", etiqueta: "Miércoles" },
  { clave: "jueves", etiqueta: "Jueves" },
  { clave: "viernes", etiqueta: "Viernes" },
  { clave: "sabado", etiqueta: "Sábado" },
  { clave: "domingo", etiqueta: "Domingo" },
] as const;

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
}

interface PageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function PanelPage({ searchParams }: PageProps) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  // No es una página de error: si el rol no es 'negocio' simplemente no
  // es la sección que le corresponde a este usuario.
  if (perfil?.rol !== "negocio") redirect("/");

  // Relación 1:1 asumida a propósito para esta primera versión: un
  // perfil con rol 'negocio' gestiona exactamente un negocio
  // (negocios.propietario_id = auth.uid()). Si en el futuro un mismo
  // perfil puede tener varios negocios, este panel necesitará un
  // selector — no contemplado aquí.
  const { data: negocio } = await supabase
    .from("negocios")
    .select(
      "id, slug, nombre, descripcion, direccion, categoria_id, telefono, web, horario, imagen_portada"
    )
    .eq("propietario_id", user.id)
    .maybeSingle()
    .returns<NegocioPanel>();

  // Las mismas secciones que usa la navegación del sitio, para que un
  // evento de un bar caiga en "Gastronomía" y no en un catálogo aparte.
  const { data: categorias } = await supabase
    .from("categorias")
    .select("id, nombre")
    .order("orden")
    .returns<{ id: string; nombre: string }[]>();

  const { data: eventos } = negocio
    ? await supabase
        .from("eventos")
        .select("id, slug, titulo, fecha_inicio, es_todo_el_dia, lugar_nombre")
        .eq("negocio_id", negocio.id)
        .eq("origen", "negocio")
        .or(filtroEventosVigentes())
        .order("fecha_inicio", { ascending: true })
        .returns<EventoPanel[]>()
    : { data: [] as EventoPanel[] };

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
    };

    const portada = formData.get("portada");
    if (portada instanceof File && portada.size > 0) {
      const ruta = `${negocioId}/${Date.now()}-${portada.name}`;
      const { error: errorSubida } = await supabase.storage
        .from(BUCKET_PORTADAS)
        .upload(ruta, portada, { upsert: true });

      if (!errorSubida) {
        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET_PORTADAS).getPublicUrl(ruta);
        cambios.imagen_portada = publicUrl;
      }
      // Si la subida falla (p. ej. el bucket todavía no existe), se
      // ignora en silencio y se guardan igualmente el resto de cambios
      // del formulario con la portada anterior.
    }

    // La RLS de negocios ("Dueño edita su negocio", propietario_id =
    // auth.uid(), en 0001_init.sql) es la que realmente protege esto: si
    // negocioId no fuera del usuario, el update afectaría a 0 filas.
    await supabase.from("negocios").update(cambios).eq("id", negocioId);

    revalidatePath("/panel");
    if (slug) revalidatePath(`/negocio/${slug}`);
  }

  return (
    <>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-oliva-900">
            Panel de negocio
          </h1>
          <p className="mt-2 text-oliva-700">
            Edita la ficha pública de tu negocio en Jaén Guía.
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

        {!negocio ? (
          <EstadoVacio mensaje="Tu perfil aún no tiene ningún negocio asociado. Contacta con el equipo de Jaén Guía para vincularlo." />
        ) : (
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
                      defaultValue={negocio.horario?.[dia.clave] ?? ""}
                      className="flex-1 rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            <div>
              {/* label y no <p>: era el único campo del proyecto sin
                  etiqueta asociada, y un lector de pantalla anunciaba
                  solo "botón Seleccionar archivo", sin decir de qué. */}
              <label
                htmlFor="portada"
                className="block text-base font-medium text-oliva-700"
              >
                Foto de portada
              </label>
              {negocio.imagen_portada && (
                /* eslint-disable-next-line @next/next/no-img-element -- URL de Supabase Storage, sin dominio fijo que declarar en next.config */
                <img
                  src={negocio.imagen_portada}
                  alt="Foto de portada actual de tu negocio"
                  className="mt-2 h-32 w-full rounded-xl object-cover"
                />
              )}
              <input
                id="portada"
                type="file"
                name="portada"
                accept="image/*"
                aria-describedby="portada-ayuda"
                className="mt-2 block w-full text-base text-oliva-700 file:mr-3 file:rounded-full file:border-0 file:bg-oliva-100 file:px-4 file:py-2.5 file:text-base file:font-medium file:text-oliva-700 hover:file:bg-oliva-600 hover:file:text-white"
              />
              <p id="portada-ayuda" className="mt-1 text-sm text-oliva-600">
                Deja este campo vacío para mantener la foto actual.
              </p>
            </div>

            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-full bg-terracota-600 px-5 text-base font-semibold text-white hover:bg-terracota-700 transition-colors"
            >
              Guardar cambios
            </button>
          </form>
        )}

        {negocio && (
          <EventosNegocio
            negocio={negocio}
            categorias={categorias ?? []}
            eventos={eventos ?? []}
          />
        )}
      </main>
    </>
  );
}
