import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BotonEnviar from "@/components/ui/BotonEnviar";
import { rutaInternaSegura } from "@/lib/rutas";

export const metadata: Metadata = {
  title: "Iniciar sesión · Jaén Guía",
  description: "Accede a tu cuenta de Jaén Guía para dejar reseñas y guardar tus favoritos.",
};

/**
 * Supabase Auth devuelve sus errores en inglés y hasta ahora se pintaban
 * tal cual: quien se equivocaba de contraseña leía "Invalid login
 * credentials". Mismo criterio que `traducirErrorSupabase` en
 * lib/actions/auth.ts, pero aquí además se dice qué hacer.
 */
function traducirError(mensaje: string): string {
  const m = mensaje.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "El email o la contraseña no son correctos. Revísalos e inténtalo otra vez.";
  }
  if (m.includes("email not confirmed")) {
    return "Todavía no has confirmado tu cuenta. Busca el correo que te enviamos y pulsa el enlace.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.";
  }
  if (m.includes("user not found")) {
    return "No hay ninguna cuenta con ese email.";
  }

  return "No hemos podido entrar. Inténtalo de nuevo en un momento.";
}

async function iniciarSesion(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const volver = rutaInternaSegura(String(formData.get("volver") ?? ""));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const params = new URLSearchParams({ error: traducirError(error.message) });
    if (volver !== "/") params.set("volver", volver);
    redirect(`/login?${params}`);
  }

  redirect(volver);
}

interface PageProps {
  searchParams: Promise<{ error?: string; volver?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error, volver } = await searchParams;
  // Adónde volver después de entrar. Lo rellena, por ejemplo, el botón
  // de favoritos cuando se pulsa sin sesión iniciada.
  const destino = rutaInternaSegura(volver);

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
          {/* El aviso va antes del formulario y con role="alert" para que
              un lector de pantalla lo anuncie al cargar la página. */}
          {error && (
            <div
              role="alert"
              className="mb-6 rounded-2xl border border-terracota-600/30 bg-terracota-600/10 px-4 py-3"
            >
              <p className="text-base font-semibold text-terracota-600">{error}</p>
            </div>
          )}

          <form action={iniciarSesion} className="space-y-5">
            <input type="hidden" name="volver" value={destino} />

            <div>
              <label
                htmlFor="email"
                className="text-sm font-bold tracking-wide uppercase text-terracota-600 mb-2 block"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                className="w-full rounded-2xl border border-oliva-100 bg-tierra-50 px-4 py-3 text-base text-oliva-900 outline-none focus:border-terracota-400 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-sm font-bold tracking-wide uppercase text-terracota-600 mb-2 block"
              >
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-oliva-100 bg-tierra-50 px-4 py-3 text-base text-oliva-900 outline-none focus:border-terracota-400 focus:bg-white transition-all"
              />
              <p className="mt-2">
                <Link
                  href="/recuperar"
                  className="inline-flex min-h-11 items-center text-base font-semibold text-terracota-600 hover:underline"
                >
                  ¿Has olvidado tu contraseña?
                </Link>
              </p>
            </div>

            <BotonEnviar
              textoEnviando="Entrando…"
              className="mt-4 w-full min-h-12 rounded-full bg-oliva-900 px-4 text-base font-bold text-white hover:bg-terracota-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md"
            >
              Entrar
            </BotonEnviar>
          </form>

          <p className="mt-8 text-center text-base font-medium text-oliva-600">
            ¿No tienes cuenta?{" "}
            <Link
              href="/registro"
              className="font-bold text-terracota-600 hover:text-terracota-700 transition-colors"
            >
              Regístrate aquí
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
