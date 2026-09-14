import { createClient } from "@/lib/supabase/server";

// Cuándo entró el último evento leído de redes o agendas: es lo que se
// enseña como "actualizado" en la portada y en /eventos. La agenda se
// rellena sola cada mañana y conviene decirlo: al principio hay pocos
// eventos y sin esta línea parecería una web parada, no una que acaba
// de empezar a llenarse.
export async function getUltimaActualizacion(): Promise<Date | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("eventos")
    .select("created_at")
    .eq("estado", "publicado")
    .in("origen", ["scraper", "instagram", "facebook", "whatsapp"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string }>();
  return data ? new Date(data.created_at) : null;
}

/** "hoy a las 09:12" | "el 13 de septiembre a las 09:12" | null */
export function textoActualizacion(fecha: Date | null) {
  if (!fecha) return null;
  const hora = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(fecha);
  const dia = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long" }).format(fecha);
  const hoy = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long" }).format(new Date());
  return dia === hoy ? `hoy a las ${hora}` : `el ${dia} a las ${hora}`;
}
