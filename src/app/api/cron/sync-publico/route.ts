import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarInstagramPublico, sincronizarFacebookPublico } from "@/lib/sync-publico";

// Lee Instagram (Business Discovery) y Facebook (Apify) de los negocios
// que tienen esas redes rellenadas, sin que hayan conectado nada.
// ?red=instagram|facebook para lanzar solo una; ?lote=N para el tamaño.
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

  const { searchParams } = new URL(request.url);
  const red = searchParams.get("red");
  const lote = Number(searchParams.get("lote")) || undefined;

  const resumen = [];
  if (!red || red === "instagram") resumen.push(await sincronizarInstagramPublico(admin, lote));
  if (!red || red === "facebook") resumen.push(await sincronizarFacebookPublico(admin, lote));
  return NextResponse.json({ ok: true, resumen });
}
