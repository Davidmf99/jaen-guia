"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { paginasDelUsuario } from "@/lib/facebook";
import { guardarConexion, leerTokenTemporal, borrarTokenTemporal, usuarioMiembro } from "@/lib/facebook-conexion";
import { sincronizarConexion, SELECT_CONEXION, type ConexionSync } from "@/lib/sync-social";

/** El usuario administra varias páginas y elige una en /panel/[slug]/facebook. */
export async function elegirPagina(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const negocioId = String(formData.get("negocio_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const pageId = String(formData.get("page_id") ?? "");
  const volver = (msg: string, tipo: "ok" | "error"): never =>
    redirect(`/panel/${slug}?${tipo}=${encodeURIComponent(msg)}#facebook`);

  if (!(await usuarioMiembro(supabase, negocioId, user.id))) return volver("No gestionas ese negocio.", "error");

  const token = await leerTokenTemporal();
  if (!token) return volver("La sesión con Facebook ha caducado. Vuelve a conectar.", "error");

  const admin = createAdminClient();
  if (!admin) return volver("Falta configuración del servidor.", "error");

  // Se vuelve a pedir la lista a Meta en vez de fiarse del page_id del
  // formulario: así el token de página que se guarda es el de una
  // página que el usuario administra de verdad.
  const paginas = await paginasDelUsuario(token);
  const pagina = paginas.find((p) => p.id === pageId);
  if (!pagina) return volver("Esa página no está entre las que administras.", "error");

  const fallo = await guardarConexion(admin, negocioId, user.id, pagina);
  await borrarTokenTemporal();
  if (fallo) return volver(fallo, "error");

  revalidatePath(`/panel/${slug}`);
  volver(`Conectado con «${pagina.name}». Lo que publiques ahí aparecerá aquí para revisar.`, "ok");
}

export async function desconectarFacebook(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const negocioId = String(formData.get("negocio_id") ?? "");
  const slug = String(formData.get("slug") ?? "");

  // La policy "Miembro desconecta su negocio" es la que manda.
  const { error } = await supabase
    .from("negocios_conexiones")
    .delete()
    .eq("negocio_id", negocioId)
    .eq("plataforma", "facebook");

  revalidatePath(`/panel/${slug}`);
  redirect(
    `/panel/${slug}?${error ? "error" : "ok"}=${encodeURIComponent(
      error ? "No hemos podido desconectar." : "Facebook desconectado. Los borradores ya creados se quedan."
    )}#facebook`
  );
}

/**
 * "Revisar ahora" desde el panel. En el plan Hobby de Vercel el cron
 * solo corre una vez al día; esto deja al dueño forzar la lectura tras
 * publicar algo. Se limita a una vez cada 10 minutos por negocio.
 */
export async function revisarFacebookAhora(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const negocioId = String(formData.get("negocio_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const volver = (msg: string, tipo: "ok" | "error"): never =>
    redirect(`/panel/${slug}?${tipo}=${encodeURIComponent(msg)}#facebook`);

  if (!(await usuarioMiembro(supabase, negocioId, user.id))) return volver("No gestionas ese negocio.", "error");

  const admin = createAdminClient();
  if (!admin) return volver("Falta configuración del servidor.", "error");

  const { data: conexion } = await admin
    .from("negocios_conexiones")
    .select(SELECT_CONEXION)
    .eq("negocio_id", negocioId)
    .eq("plataforma", "facebook")
    .maybeSingle<ConexionSync>();
  if (!conexion) return volver("Este negocio no tiene Facebook conectado.", "error");

  if (Date.now() - new Date(conexion.ultima_sync).getTime() < 10 * 60 * 1000) {
    return volver("Ya lo hemos revisado hace un momento. Espera unos minutos.", "error");
  }

  const r = await sincronizarConexion(admin, conexion);
  revalidatePath(`/panel/${slug}`);
  if (r.error) return volver(`Facebook ha dado un error: ${r.error}`, "error");
  volver(
    r.borradoresNuevos === 0
      ? "Revisado: nada nuevo desde la última vez."
      : `Revisado: ${r.borradoresNuevos === 1 ? "1 evento nuevo" : `${r.borradoresNuevos} eventos nuevos`} para revisar.`,
    "ok"
  );
}
