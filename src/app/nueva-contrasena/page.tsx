import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BotonEnviar from "@/components/ui/BotonEnviar";
import { requisitosPassword } from "@/lib/validaciones/registro";

export const metadata: Metadata = {
  title: "Nueva contraseña · Jaén Guía",
  description: "Escribe la contraseña nueva de tu cuenta.",
  robots: { index: false, follow: false },
};

// Segundo paso de la recuperación. Se llega desde el enlace del correo,
// que pasa antes por /auth/callback: allí se canjea el código por una
// sesión, así que aquí ya hay usuario y basta con updateUser.
async function guardarPassword(formData: FormData) {
  "use server";

  const password = String(formData.get("password") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");

  const fallar = (mensaje: string) =>
    redirect(`/nueva-contrasena?error=${encodeURIComponent(mensaje)}`);

  if (password !== confirmar) {
    fallar("Las dos contraseñas no coinciden. Vuelve a escribirlas.");
  }

  // Los mismos mínimos que pide el registro, para no tener dos varas de
  // medir según por dónde entres.
  const requisitos = requisitosPassword(password);
  if (!requisitos.longitud || !requisitos.mayuscula || !requisitos.minuscula || !requisitos.numero) {
    fallar(
      "La contraseña necesita al menos 8 caracteres, una mayúscula, una minúscula y un número."
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/recuperar?error=" +
        encodeURIComponent("El enlace ha caducado. Pide otro y ábrelo cuanto antes.")
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    fallar("No hemos podido guardar la contraseña. Inténtalo otra vez.");
  }

  redirect("/nueva-contrasena?ok=1");
}

interface PageProps {
  searchParams: Promise<{ error?: string; ok?: string }>;
}

export default async function NuevaContrasenaPage({ searchParams }: PageProps) {
  const { error, ok } = await searchParams;

  return (
    <>
      <main className="min-h-screen bg-tierra-50 flex flex-col items-center pt-24 pb-20 px-6">
        <div className="w-full max-w-md text-center mb-10">
          <h1 className="font-display text-4xl md:text-5xl tracking-tight text-oliva-900 mb-4">
            {ok ? "Contraseña cambiada." : "Tu contraseña nueva"}
          </h1>
          <p className="text-lg text-oliva-700">
            {ok
              ? "Ya puedes usarla para entrar en tu cuenta."
              : "Escríbela dos veces para asegurarnos de que no hay ninguna errata."}
          </p>
        </div>

        <div className="w-full max-w-md rounded-[2rem] bg-white p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-oliva-100">
          {ok ? (
            <Link
              href="/login"
              className="flex min-h-12 w-full items-center justify-center rounded-full bg-oliva-900 px-6 text-base font-bold text-white hover:bg-terracota-700 transition-colors"
            >
              Iniciar sesión
            </Link>
          ) : (
            <>
              {error && (
                <div
                  role="alert"
                  className="mb-6 rounded-2xl border border-terracota-600/30 bg-terracota-600/10 px-4 py-3"
                >
                  <p className="text-base font-semibold text-terracota-600">
                    {error}
                  </p>
                </div>
              )}

              <form action={guardarPassword} className="space-y-5">
                <div>
                  <label
                    htmlFor="password"
                    className="text-sm font-bold tracking-wide uppercase text-terracota-600 mb-2 block"
                  >
                    Contraseña nueva
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    aria-describedby="password-ayuda"
                    className="w-full rounded-2xl border border-oliva-100 bg-tierra-50 px-4 py-3 text-base text-oliva-900 outline-none focus:border-terracota-400 focus:bg-white transition-all"
                  />
                  <p id="password-ayuda" className="mt-2 text-sm text-oliva-600">
                    Al menos 8 caracteres, con una mayúscula, una minúscula y un
                    número.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="confirmar"
                    className="text-sm font-bold tracking-wide uppercase text-terracota-600 mb-2 block"
                  >
                    Repítela
                  </label>
                  <input
                    id="confirmar"
                    name="confirmar"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="w-full rounded-2xl border border-oliva-100 bg-tierra-50 px-4 py-3 text-base text-oliva-900 outline-none focus:border-terracota-400 focus:bg-white transition-all"
                  />
                </div>

                <BotonEnviar
                  textoEnviando="Guardando…"
                  className="w-full min-h-12 rounded-full bg-oliva-900 px-4 text-base font-bold text-white hover:bg-terracota-700 transition-all shadow-md"
                >
                  Guardar contraseña
                </BotonEnviar>
              </form>
            </>
          )}
        </div>
      </main>
    </>
  );
}
