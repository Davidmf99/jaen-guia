"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Toggle: si la fila ya existe en favoritos, la borra; si no, la crea.
// Sin sesión, redirige a /login en vez de fallar en silencio o insertar
// con un usuario_id inválido.
export async function toggleFavorito(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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

  const pathname = String(formData.get("pathname") ?? "");
  if (pathname) revalidatePath(pathname);
}
