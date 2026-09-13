import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarConexion, SELECT_CONEXION, type ConexionSync, type ResumenSync } from "@/lib/sync-social";

// Recorre todas las páginas de Facebook conectadas (migración 0014) y
// deja como borrador lo que parezca un evento. Mismo esquema de
// autenticación que sync-events: Vercel Cron manda CRON_SECRET.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function secretoValido(cabecera: string | null, secreto: string) {
  const recibido = Buffer.from((cabecera ?? "").replace(/^Bearer\s+/i, ""));
  const esperado = Buffer.from(secreto);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "Falta CRON_SECRET." }, { status: 500 });
  if (!secretoValido(request.headers.get("authorization"), secreto)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });

  const { data: conexiones, error } = await admin
    .from("negocios_conexiones")
    .select(SELECT_CONEXION)
    .eq("plataforma", "facebook")
    .returns<ConexionSync[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const resumen: ResumenSync[] = [];
  for (const c of conexiones ?? []) {
    resumen.push(await sincronizarConexion(admin, c));
  }
  for (const r of resumen) {
    if (r.borradoresNuevos > 0) revalidatePath(`/panel/${r.negocio}`);
  }
  return NextResponse.json({ ok: true, conexiones: resumen.length, resumen });
}
