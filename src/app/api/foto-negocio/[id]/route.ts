import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Proxy server-side a la Photo Media API de Google Places (New). Las
// condiciones de uso de Google no permiten guardar/redistribuir la
// imagen de forma permanente, así que aquí NUNCA se descarga a
// Storage ni se cachea "para siempre": cada petición resuelve
// google_photo_name contra Google en el momento, con un
// Cache-Control corto (ver abajo).
const GOOGLE_PHOTO_MEDIA_URL = "https://places.googleapis.com/v1";
const MAX_WIDTH_PX = 800;
// 3 días. Suficiente para no golpear a Google en cada visita, sin
// llegar a ser una caché "permanente".
const CACHE_CONTROL = "public, max-age=259200";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: negocio } = await supabase
    .from("negocios")
    .select("google_photo_name")
    .eq("id", id)
    .maybeSingle();

  if (!negocio?.google_photo_name) {
    return new NextResponse(null, { status: 404 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("[foto-negocio] Falta GOOGLE_PLACES_API_KEY en el servidor");
    return new NextResponse(null, { status: 500 });
  }

  const googleRes = await fetch(
    `${GOOGLE_PHOTO_MEDIA_URL}/${negocio.google_photo_name}/media?maxWidthPx=${MAX_WIDTH_PX}`,
    { headers: { "X-Goog-Api-Key": apiKey } }
  );

  if (!googleRes.ok || !googleRes.body) {
    return new NextResponse(null, { status: 502 });
  }

  return new NextResponse(googleRes.body, {
    status: 200,
    headers: {
      "Content-Type": googleRes.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
