import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/layout/Header";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Iniciar sesión · Jaén Guía",
  description: "Accede a tu cuenta de Jaén Guía para dejar reseñas y guardar tus favoritos.",
};

async function iniciarSesion(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12">
        <h1 className="font-display text-3xl font-semibold text-oliva-900">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-oliva-700">
          Accede para dejar reseñas y guardar tus favoritos.
        </p>

        <form
          action={iniciarSesion}
          className="mt-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm"
        >
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
              autoComplete="current-password"
              required
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
            Entrar
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-oliva-700">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-terracota-600 hover:underline">
            Regístrate
          </Link>
        </p>
      </main>
    </>
  );
}
