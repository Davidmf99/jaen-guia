"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { rutaInternaSegura } from "@/lib/rutas";

// Toggle: si la fila ya existe en favoritos, la borra; si no, la crea.
// Sin sesión, redirige a /login en vez de fallar en silencio o insertar
// con un usuario_id inválido.
export async function toggleFavorito(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = String(formData.get("pathname") ?? "");

  if (!user) {
    // Con la ruta de vuelta: antes se redirigía a /login a secas y, tras
    // iniciar sesión, el usuario acababa en la portada en vez de en el
    // negocio que estaba intentando guardar.
    const volver = rutaInternaSegura(pathname);
    redirect(`/login?volver=${encodeURIComponent(volver)}`);
  }

  const negocioId = String(formData.get("negocio_id") ?? "");
  if (!negocioId) return;

  const { data: existente } = await supabase
    .from("favoritos")
    .select("negocio_id")
    .eq("usuario_id", user.id)
    .eq("negocio_id", negocioId)
    .maybeSingle();

  if (existente) {
    await supabase
      .from("favoritos")
      .delete()
      .eq("usuario_id", user.id)
      .eq("negocio_id", negocioId);
  } else {
    await supabase
      .from("favoritos")
      .insert({ usuario_id: user.id, negocio_id: negocioId });
  }

  if (pathname) revalidatePath(pathname);
}
