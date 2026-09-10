import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BotonEnviar from "@/components/ui/BotonEnviar";

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
      <main className="min-h-screen bg-tierra-50 flex flex-col items-center pt-24 pb-20 px-6">
        
        <div className="w-full max-w-md text-center mb-10">
          <h1 className="font-display text-5xl md:text-6xl tracking-tight text-oliva-900 mb-4">
            Bienvenido.
          </h1>
          <p className="text-lg text-oliva-700">
            Accede para dejar reseñas y guardar tus lugares favoritos de Jaén.
          </p>
        </div>

        <div className="w-full max-w-md rounded-[2rem] bg-white p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-oliva-100">
          <form
            action={iniciarSesion}
            className="space-y-5"
          >
            <div>
              <label htmlFor="email" className="text-sm font-bold tracking-wide uppercase text-terracota-600 mb-2 block">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-2xl border border-oliva-100 bg-tierra-50 px-4 py-3 text-base text-oliva-900 outline-none focus:border-terracota-400 focus:bg-white transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="text-sm font-bold tracking-wide uppercase text-terracota-600 block">
                  Contraseña
                </label>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-oliva-100 bg-tierra-50 px-4 py-3 text-base text-oliva-900 outline-none focus:border-terracota-400 focus:bg-white transition-all"
              />
            </div>

            {error && (
              <div className="rounded-2xl bg-terracota-500/10 border border-terracota-500/20 px-4 py-3">
                <p className="text-sm font-semibold text-terracota-600 text-center">
                  {error}
                </p>
              </div>
            )}

            <BotonEnviar
              textoEnviando="Entrando…"
              className="mt-4 w-full rounded-full bg-oliva-900 px-4 py-3.5 text-sm font-bold text-white hover:bg-terracota-600 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md"
            >
              Entrar
            </BotonEnviar>
          </form>

          <p className="mt-8 text-center text-sm font-medium text-oliva-600">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-bold text-terracota-600 hover:text-terracota-500 transition-colors">
              Regístrate aquí
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
