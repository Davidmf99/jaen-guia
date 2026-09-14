import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarInstagramPublico, sincronizarFacebookPublico, sincronizarFuentesPublicas } from "@/lib/sync-publico";
import { avisarAdmin, correoAdminSyncRedes } from "@/lib/email";

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
  // Presupuesto de Apify: el plan gratis son 5 $/mes y cada post leído
  // cuesta. Instagram 15 cuentas/día y Facebook solo en días alternos
  // (~0,12 $/día): cada cuenta se lee cada 5-6 días, que para un bar que
  // anuncia con una semana basta. Con ?red= se fuerza cualquiera.
  const diaDelAnio = Math.floor((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86400000);
  const tocaFacebook = red === "facebook" || (!red && diaDelAnio % 2 === 0);
  const resumen = [];
  if (!red || red === "fuentes") resumen.push(await sincronizarFuentesPublicas(admin, hasta));
  if (!red || red === "instagram") resumen.push(await sincronizarInstagramPublico(admin, lote ?? 15, hasta));
  if (tocaFacebook) resumen.push(await sincronizarFacebookPublico(admin, lote ?? 10, hasta));
  const segundos = Math.round((Date.now() - (hasta - 250_000)) / 1000);

  // Aviso solo cuando algo huele mal: errores que no sean "sin tiempo"
  // (eso es normal), o una pasada completa sin un solo post con 85
  // cuentas leídas (token caducado, Apify caído...).
  const erroresReales = resumen.flatMap((r) => r.errores.filter((e) => !e.startsWith("Sin tiempo")));
  const leidas = resumen.reduce((t, r) => t + r.negocios, 0);
  const posts = resumen.reduce((t, r) => t + r.publicaciones, 0);
  const motivo = erroresReales.length
    ? `${erroresReales.length} error(es) en la pasada`
    : !red && leidas >= 10 && posts === 0
      ? `0 posts en ${leidas} cuentas`
      : null;
  if (motivo) await avisarAdmin(correoAdminSyncRedes({ motivo, resumen, segundos }));

  return NextResponse.json({ ok: true, resumen, segundos, aviso: motivo });
}
