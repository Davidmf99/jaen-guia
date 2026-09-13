import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cifrar, descifrar } from "@/lib/cifrado";
import type { PaginaFacebook } from "@/lib/facebook";

// Piezas compartidas por el callback OAuth y las Server Actions de
// Facebook. Fichero aparte y SIN "use server": lo que se exporta desde
// un fichero "use server" se convierte en endpoint público, y
// guardarConexion no debe serlo.

// Cookie temporal con el token de usuario de Facebook entre el callback
// y la elección de página (solo cuando el usuario administra varias).
// httpOnly + cifrada: el navegador no puede leerla y un volcado de
// cookies no sirve sin FACEBOOK_APP_SECRET.
const COOKIE_TOKEN_FB = "fb_token_tmp";

export async function guardarTokenTemporal(tokenUsuario: string) {
  const jar = await cookies();
  jar.set(COOKIE_TOKEN_FB, cifrar(tokenUsuario), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
}

export async function leerTokenTemporal(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(COOKIE_TOKEN_FB)?.value;
  if (!v) return null;
  try {
    return descifrar(v);
  } catch {
    return null;
  }
}

export async function borrarTokenTemporal() {
  const jar = await cookies();
  jar.delete(COOKIE_TOKEN_FB);
}

/** Inserta/actualiza la conexión. Devuelve un mensaje de error o null. */
export async function guardarConexion(
  admin: SupabaseClient,
  negocioId: string,
  userId: string,
  pagina: PaginaFacebook
): Promise<string | null> {
  const { error } = await admin.from("negocios_conexiones").upsert(
    {
      negocio_id: negocioId,
      plataforma: "facebook",
      page_id: pagina.id,
      page_nombre: pagina.name,
      page_token_cifrado: cifrar(pagina.access_token),
      ig_user_id: pagina.instagram_business_account?.id ?? null,
      ig_username: pagina.instagram_business_account?.username ?? null,
      conectado_por: userId,
      ultima_sync: new Date().toISOString(),
      ultimo_error: null,
    },
    { onConflict: "negocio_id,plataforma" }
  );
  if (error) {
    // uq_conexiones_page: esa página ya está en otro negocio.
    if (error.code === "23505") return "Esa página ya está conectada a otro negocio.";
    return "No hemos podido guardar la conexión.";
  }
  return null;
}

/** Membresía aprobada del usuario en el negocio (misma regla que el panel). */
export async function usuarioMiembro(supabase: SupabaseClient, negocioId: string, userId: string) {
  const { data } = await supabase
    .from("negocios_miembros")
    .select("negocio_id")
    .eq("negocio_id", negocioId)
    .eq("perfil_id", userId)
    .eq("estado", "aprobado")
    .maybeSingle();
  return Boolean(data);
}
