import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BotonEnviar from "@/components/ui/BotonEnviar";

export const metadata: Metadata = {
  title: "Recuperar contraseña · Jaén Guía",
  description: "Te enviamos un correo para que puedas poner una contraseña nueva.",
  robots: { index: false, follow: false },
};

// Primer paso de la recuperación: pedir el correo y mandar el enlace.
// El segundo paso vive en /nueva-contrasena, al que se llega desde el
// enlace del email pasando por /auth/callback.
//
// Hasta ahora no existía ninguna forma de recuperar la contraseña: ni
// ruta, ni enlace, ni acción. Para el público de esta guía —gente que
// entra de tanto en tanto— olvidarla es el caso normal, no el raro.
async function enviarEnlace(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const supabase = await createClient();

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/callback?siguiente=/nueva-contrasena`,
  });

  // Siempre se responde lo mismo, haya cuenta o no: si el mensaje
  // cambiara, esta página serviría para averiguar qué correos están
  // registrados en Jaén Guía.
  redirect("/recuperar?enviado=1");
}

interface PageProps {
  searchParams: Promise<{ enviado?: string; error?: string }>;
}

export default async function RecuperarPage({ searchParams }: PageProps) {
  const { enviado, error } = await searchParams;

  return (
    <>
      <main className="min-h-screen bg-tierra-50 flex flex-col items-center pt-24 pb-20 px-6">
        <div className="w-full max-w-md text-center mb-10">
          <h1 className="font-display text-4xl md:text-5xl tracking-tight text-oliva-900 mb-4">
            ¿Has olvidado la contraseña?
          </h1>
          <p className="text-lg text-oliva-700">
            No pasa nada. Escribe tu email y te mandamos un enlace para poner
            una nueva.
          </p>
        </div>

        <div className="w-full max-w-md rounded-[2rem] bg-white p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-oliva-100">
          {error && (
            <div
              role="alert"
              className="mb-6 rounded-2xl border border-terracota-600/30 bg-terracota-600/10 px-4 py-3"
            >
              <p className="text-base font-semibold text-terracota-600">{error}</p>
            </div>
          )}

          {enviado ? (
            <div className="text-center">
              <MailCheck
                size={40}
                aria-hidden="true"
                className="mx-auto mb-4 text-terracota-600"
              />
              <h2 className="font-display text-2xl text-oliva-900 mb-3">
                Mira tu correo
              </h2>
              <p className="text-base text-oliva-700">
                Si ese email tiene cuenta en Jaén Guía, le acaba de llegar un
                mensaje con un enlace. Ábrelo y podrás escribir una contraseña
                nueva. Si no lo ves, mira en la carpeta de correo no deseado.
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex min-h-12 items-center rounded-full bg-oliva-900 px-6 text-base font-bold text-white hover:bg-terracota-700 transition-colors"
              >
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <form action={enviarEnlace} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="text-sm font-bold tracking-wide uppercase text-terracota-600 mb-2 block"
                >
                  Tu email
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

              <BotonEnviar
                textoEnviando="Enviando…"
                className="w-full min-h-12 rounded-full bg-oliva-900 px-4 text-base font-bold text-white hover:bg-terracota-700 transition-all shadow-md"
              >
                Enviarme el enlace
              </BotonEnviar>

              <p className="text-center text-base font-medium text-oliva-600">
                <Link
                  href="/login"
                  className="font-bold text-terracota-600 hover:text-terracota-700 transition-colors"
                >
                  Volver a iniciar sesión
                </Link>
              </p>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
