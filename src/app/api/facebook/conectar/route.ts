import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { firmarEstado } from "@/lib/cifrado";
import { urlLogin, facebookConfigurado } from "@/lib/facebook";
import { usuarioMiembro } from "@/lib/facebook-conexion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NONCE = "fb_oauth_nonce";

function urlCallback(request: Request) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  return `${base.replace(/\/$/, "")}/api/facebook/callback`;
}

/**
 * Arranque del login de Facebook desde /panel/[slug]. Comprueba que el
 * usuario gestiona el negocio, firma un state con (negocio, usuario,
 * nonce) y manda a Meta. El nonce va también en una cookie: en el
 * callback tienen que coincidir (anti-CSRF).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("negocio") ?? "";
  const volver = (msg: string) =>
    NextResponse.redirect(new URL(`/panel/${slug}?error=${encodeURIComponent(msg)}#facebook`, request.url));

  if (!facebookConfigurado()) return volver("Facebook no está configurado todavía.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/login?volver=${encodeURIComponent(`/panel/${slug}`)}`, request.url));

  const { data: negocio } = await supabase.from("negocios").select("id").eq("slug", slug).maybeSingle();
  if (!negocio || !(await usuarioMiembro(supabase, negocio.id, user.id))) return volver("No gestionas ese negocio.");

  const nonce = randomBytes(16).toString("base64url");
  const state = firmarEstado({ negocioId: negocio.id, slug, userId: user.id, nonce });

  const jar = await cookies();
  jar.set(COOKIE_NONCE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  return NextResponse.redirect(urlLogin(urlCallback(request), state));
}
