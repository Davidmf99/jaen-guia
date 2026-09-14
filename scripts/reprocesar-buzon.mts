// Vuelve a leer con el prompt actual los mensajes ya guardados en
// buzon_mensajes (texto + imagen del bucket), sin tocar Apify ni Meta.
// Sustituye los eventos que generó la lectura anterior. Para aplicar
// mejoras del prompt a lo que ya entró.
//
//   npx --yes tsx --env-file=.env.local --conditions=react-server scripts/reprocesar-buzon.mts [instagram|facebook|whatsapp] [--solo-borradores] [--remitente=usuario]
import { createAdminClient } from "../src/lib/supabase/admin";
import { reprocesarMensaje } from "../src/lib/buzon";

const canal = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? null;
const soloBorradores = process.argv.includes("--solo-borradores");
// --remitente=salalapaca para afinar el prompt con una sola cuenta.
const remitente = process.argv.find((a) => a.startsWith("--remitente="))?.slice("--remitente=".length) ?? null;

const admin = createAdminClient();
if (!admin) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

let consulta = admin.from("buzon_mensajes").select("id, canal, remitente_nombre, estado").order("created_at");
if (canal) consulta = consulta.eq("canal", canal);
if (soloBorradores) consulta = consulta.eq("estado", "borrador");
if (remitente) consulta = consulta.eq("remitente", remitente);
const { data: mensajes, error } = await consulta;
if (error) throw error;

const cuenta: Record<string, number> = {};
for (const [i, m] of (mensajes ?? []).entries()) {
  const salida = await reprocesarMensaje(admin, m.id);
  cuenta[salida.estado] = (cuenta[salida.estado] ?? 0) + 1;
  const titulo = salida.extraido?.es_evento ? `${salida.extraido.titulo} · ${salida.extraido.confianza}` : "";
  console.log(`${String(i + 1).padStart(3)} ${m.canal} ${m.remitente_nombre ?? m.id} → ${salida.estado} ${titulo}`);
}
console.log("\nResumen:", cuenta);
