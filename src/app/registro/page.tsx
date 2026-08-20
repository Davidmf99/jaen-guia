import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Crear cuenta · Jaén Guía",
  description: "Regístrate en Jaén Guía para dejar reseñas y guardar tus favoritos.",
};

// La fila en `perfiles` (con rol = 'usuario' por defecto) la crea el
// trigger on_auth_user_created de supabase/migrations/0001_init.sql,
// no esta Server Action — así funciona igual para altas por email que,
// en el futuro, por OAuth. El `nombre` viaja en los metadatos del alta
// porque el trigger lo lee de raw_user_meta_data->>'nombre'.
async function registrarUsuario(formData: FormData) {
  "use server";

  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre } },
  });

  if (error) {
    redirect(`/registro?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function RegistroPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12">
        <h1 className="font-display text-3xl font-semibold text-oliva-900">
          Crear cuenta
        </h1>
        <p className="mt-2 text-oliva-700">
          Únete a Jaén Guía para dejar reseñas y guardar tus favoritos.
        </p>

        <form
          action={registrarUsuario}
          className="mt-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm"
        >
          <div>
            <label htmlFor="nombre" className="text-sm font-medium text-oliva-700">
              Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              autoComplete="name"
              required
              className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2 text-sm outline-none focus:border-oliva-400"
            />
          </div>

          <div>
            <label htmlFor="email" className="text-sm font-medium text-oliva-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2 text-sm outline-none focus:border-oliva-400"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-oliva-700">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              className="mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2 text-sm outline-none focus:border-oliva-400"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-terracota-400 px-3 py-2 text-sm text-terracota-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-full bg-terracota-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-terracota-600 transition-colors"
          >
            Crear cuenta
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-oliva-700">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-terracota-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </main>
    </>
  );
}
