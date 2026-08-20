import { createClient } from "@/lib/supabase/server";

// Usuario actual + el conjunto de ids de negocio que ya tiene en
// favoritos, para poder marcar el corazón de cada NegocioCard sin una
// consulta por tarjeta. Sin sesión, favoritoIds siempre vacío.
export async function getUsuarioYFavoritos() {
  console.time("[perf] getUsuarioYFavoritos"); // TEMPORAL: quitar tras medir
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, favoritoIds: new Set<string>() };

  const { data } = await supabase
    .from("favoritos")
    .select("negocio_id")
    .eq("usuario_id", user.id);

  return {
    user,
    favoritoIds: new Set((data ?? []).map((f) => f.negocio_id)),
  };
  } finally {
    console.timeEnd("[perf] getUsuarioYFavoritos"); // TEMPORAL
  }
}
