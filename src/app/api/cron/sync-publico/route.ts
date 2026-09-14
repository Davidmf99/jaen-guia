import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarInstagramPublico, sincronizarFacebookPublico, sincronizarFuentesPublicas } from "@/lib/sync-publico";

// Lee Instagram (Business Discovery o, sin App Review, Apify) y Facebook (Apify) de los negocios
// que tienen esas redes rellenadas, sin que hayan conectado nada.
// ?red=instagram|facebook|fuentes para lanzar solo una; ?lote=N para el tamaño.
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

  // Presupuesto total por debajo del maxDuration (300 s). Primero las
  // cuentas fuente, que traen más eventos por post; lo que no quepa
  // queda para mañana.
  const hasta = Date.now() + 250_000;
  const resumen = [];
  if (!red || red === "fuentes") resumen.push(await sincronizarFuentesPublicas(admin, hasta));
  if (!red || red === "instagram") resumen.push(await sincronizarInstagramPublico(admin, lote, hasta));
  if (!red || red === "facebook") resumen.push(await sincronizarFacebookPublico(admin, lote, hasta));
  return NextResponse.json({ ok: true, resumen, segundos: Math.round((Date.now() - (hasta - 250_000)) / 1000) });
}
