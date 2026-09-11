import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gradientePara } from "@/lib/gradiente";

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export const metadata: Metadata = {
  title: "Mi perfil · Jaén Guía",
  description: "Gestiona tu cuenta y preferencias en Jaén Guía.",
};

interface PerfilRow {
  nombre: string | null;
  apellidos: string | null;
  username: string | null;
  es_de_jaen: boolean;
}

interface PageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function PerfilPage({ searchParams }: PageProps) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, apellidos, username, es_de_jaen")
    .eq("id", user.id)
    .single()
    .returns<PerfilRow>();

  async function actualizarPerfil(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const cambios = {
      nombre: String(formData.get("nombre") ?? "").trim() || null,
      apellidos: String(formData.get("apellidos") ?? "").trim() || null,
      username: String(formData.get("username") ?? "").trim() || null,
      es_de_jaen: formData.get("es_de_jaen") === "on",
    };

    const { error: updateError } = await supabase
      .from("perfiles")
      .update(cambios)
      .eq("id", user.id);

    if (updateError) {
      redirect(`/perfil?error=${encodeURIComponent("No se pudo actualizar el perfil. Comprueba que el nombre de usuario no esté cogido.")}`);
    } else {
      revalidatePath("/", "layout");
      redirect(`/perfil?ok=${encodeURIComponent("Perfil actualizado correctamente.")}`);
    }
  }

  const nombreCompleto = [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(" ");
  const nombreMostrar = nombreCompleto || user.email || "Usuario";
  const inicialesAvatar = iniciales(nombreMostrar);
  const gradiente = gradientePara(nombreMostrar);

  const [
    { count: countFavoritos },
    { count: countResenas },
  ] = await Promise.all([
    supabase.from("favoritos").select("*", { count: "exact", head: true }).eq("usuario_id", user.id),
    supabase.from("resenas").select("*", { count: "exact", head: true }).eq("usuario_id", user.id)
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8 flex items-center gap-6 rounded-3xl bg-white p-6 shadow-sm border border-oliva-100">
        <div
          className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradiente} shadow-inner`}
        >
          <span className="font-display text-4xl font-semibold text-white/90">
            {inicialesAvatar}
          </span>
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold text-oliva-900">
            {nombreMostrar}
          </h1>
          {perfil?.username && (
            <p className="mt-1 text-lg text-terracota-600 font-medium">
              @{perfil.username}
            </p>
          )}
          {perfil?.es_de_jaen && (
            <span className="mt-2 block w-fit rounded-full bg-oliva-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-oliva-800">
              Residente de Jaén
            </span>
          )}
          
          <div className="mt-4 flex flex-wrap gap-3">
            <Link 
              href="/favoritos"
              className="inline-flex items-center gap-2 rounded-xl border border-oliva-200 bg-white px-3 py-1.5 text-sm font-semibold text-oliva-700 shadow-sm hover:border-terracota-300 hover:text-terracota-600 transition-colors"
            >
              ❤️ {countFavoritos ?? 0} Favoritos
            </Link>
            <Link 
              href="/mis-resenas"
              className="inline-flex items-center gap-2 rounded-xl border border-oliva-200 bg-white px-3 py-1.5 text-sm font-semibold text-oliva-700 shadow-sm hover:border-terracota-300 hover:text-terracota-600 transition-colors"
            >
              ⭐ {countResenas ?? 0} Reseñas escritas
            </Link>
          </div>
        </div>
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
        action={actualizarPerfil}
        className="space-y-5 rounded-3xl bg-white p-6 md:p-8 shadow-sm border border-oliva-100"
      >
        <h2 className="font-sans text-xl font-bold text-oliva-900 mb-4">
          Ajustes de la cuenta
        </h2>

        <div>
          <label htmlFor="email" className="block text-base font-medium text-oliva-700">
            Email (Solo lectura)
          </label>
          <input
            id="email"
            type="email"
            disabled
            defaultValue={user.email ?? ""}
            className="mt-1 w-full rounded-xl border border-oliva-100 bg-oliva-50 px-3 py-2.5 text-base text-oliva-500 cursor-not-allowed"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="nombre" className="block text-base font-medium text-oliva-700">
              Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              defaultValue={perfil?.nombre ?? ""}
              required
              className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
            />
          </div>
          <div>
            <label htmlFor="apellidos" className="block text-base font-medium text-oliva-700">
              Apellidos
            </label>
            <input
              id="apellidos"
              name="apellidos"
              type="text"
              defaultValue={perfil?.apellidos ?? ""}
              required
              className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400"
            />
          </div>
        </div>

        <div>
          <label htmlFor="username" className="block text-base font-medium text-oliva-700">
            Nombre de usuario
          </label>
          <div className="relative mt-1">
            <span className="absolute inset-y-0 left-4 flex items-center text-oliva-500 font-bold">
              @
            </span>
            <input
              id="username"
              name="username"
              type="text"
              defaultValue={perfil?.username ?? ""}
              required
              className="w-full rounded-xl border border-oliva-100 pl-10 pr-3 py-2.5 text-base outline-none focus:border-oliva-400"
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                name="es_de_jaen"
                defaultChecked={perfil?.es_de_jaen ?? false}
                className="peer sr-only"
              />
              <div className="h-5 w-5 rounded border-2 border-oliva-200 bg-white transition-colors peer-checked:border-terracota-600 peer-checked:bg-terracota-600 group-hover:border-oliva-400 peer-focus-visible:ring-2 peer-focus-visible:ring-terracota-600 peer-focus-visible:ring-offset-2" />
              <svg
                viewBox="0 0 14 14"
                fill="none"
                className="pointer-events-none absolute h-3.5 w-3.5 stroke-white stroke-2 opacity-0 transition-opacity peer-checked:opacity-100"
              >
                <path
                  d="M3 7L6 10L11 3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <span className="text-base font-medium text-oliva-900">
                Soy residente de la provincia de Jaén
              </span>
              <p className="text-sm text-oliva-600">
                Nos ayuda a destacar las reseñas de los locales.
              </p>
            </div>
          </label>
        </div>

        <div className="pt-4 flex items-center gap-4">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-full bg-terracota-600 px-5 text-base font-semibold text-white hover:bg-terracota-700 transition-colors"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </main>
  );
}

