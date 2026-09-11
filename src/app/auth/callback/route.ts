import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rutaInternaSegura } from "@/lib/rutas";

/**
 * Aterrizaje de los enlaces que manda Supabase por correo (de momento,
 * el de recuperar contraseña).
 *
 * El enlace trae un `code` de un solo uso: aquí se canjea por una sesión
 * —que queda escrita en las cookies por el cliente de @supabase/ssr— y
 * se manda al usuario a donde tocaba. Sin este paso, /nueva-contrasena
 * no tendría sesión con la que hacer el updateUser.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const siguiente = rutaInternaSegura(url.searchParams.get("siguiente"));

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=El+enlace+no+es+v%C3%A1lido.+Pide+otro.", url.origin)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Los enlaces de Supabase caducan y son de un solo uso: si alguien
    // abre el de ayer, o lo abre dos veces, acaba aquí.
    return NextResponse.redirect(
      new URL(
        "/recuperar?error=" +
          encodeURIComponent(
            "Ese enlace ya no sirve. Pide uno nuevo y ábrelo cuanto antes."
          ),
        url.origin
      )
    );
  }

  return NextResponse.redirect(new URL(siguiente, url.origin));
}
