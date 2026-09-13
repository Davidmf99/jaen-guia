import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { leerEstado } from "@/lib/cifrado";
import { tokenDesdeCodigo, paginasDelUsuario } from "@/lib/facebook";
import { guardarConexion, guardarTokenTemporal, usuarioMiembro } from "@/lib/facebook-conexion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Estado {
  negocioId: string;
  slug: string;
  userId: string;
  nonce: string;
}

/**
 * Vuelta de Meta. Cambia el code por un token de larga duración y
 * lista las páginas del usuario:
 *   · una página  → se conecta directamente
 *   · varias      → token en cookie cifrada y a /panel/[slug]/facebook
 *                   para elegir
 *   · ninguna     → error (la cuenta no administra páginas)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const estado = leerEstado<Estado>(searchParams.get("state"));
  const slug = estado?.slug ?? "";
  const volver = (msg: string, tipo: "ok" | "error" = "error") =>
    NextResponse.redirect(new URL(`/panel/${slug}?${tipo}=${encodeURIComponent(msg)}#facebook`, request.url));

  if (!estado) return NextResponse.redirect(new URL("/panel?error=Estado%20inv%C3%A1lido", request.url));

  const jar = await cookies();
  const nonce = jar.get("fb_oauth_nonce")?.value;
  jar.delete("fb_oauth_nonce");
  if (!nonce || nonce !== estado.nonce) return volver("La conexión ha caducado. Inténtalo otra vez.");

  // El usuario pudo cancelar en Meta.
  if (searchParams.get("error")) {
    return volver("No se ha dado permiso en Facebook. Puedes intentarlo cuando quieras.");
  }
  const code = searchParams.get("code");
  if (!code) return volver("Facebook no ha devuelto el código.");

  // Sesión propia: el state dice quién empezó, pero manda la cookie.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== estado.userId) return volver("Sesión distinta de la que empezó la conexión.");
  if (!(await usuarioMiembro(supabase, estado.negocioId, user.id))) return volver("No gestionas ese negocio.");

  const admin = createAdminClient();
  if (!admin) return volver("Falta configuración del servidor.");

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const redirectUri = `${base.replace(/\/$/, "")}/api/facebook/callback`;

  let paginas;
  try {
    const token = await tokenDesdeCodigo(code, redirectUri);
    paginas = await paginasDelUsuario(token);
    if (paginas.length > 1) {
      await guardarTokenTemporal(token);
      return NextResponse.redirect(new URL(`/panel/${slug}/facebook`, request.url));
    }
  } catch (err) {
    console.error("[facebook] callback", err);
    return volver("Facebook ha dado un error al conectar. Inténtalo más tarde.");
  }

  if (paginas.length === 0) {
    return volver("Esa cuenta de Facebook no administra ninguna página. Conecta con la cuenta que gestiona la página del local.");
  }

  const fallo = await guardarConexion(admin, estado.negocioId, user.id, paginas[0]);
  if (fallo) return volver(fallo);

  revalidatePath(`/panel/${slug}`);
  return volver(`Conectado con «${paginas[0].name}». Lo que publiques ahí aparecerá aquí para revisar.`, "ok");
}
