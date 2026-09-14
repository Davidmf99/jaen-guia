import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refresca la sesión de Supabase en cada navegación (guía oficial de
// @supabase/ssr para App Router). En Next.js 16 el fichero se llama
// proxy.ts (antes middleware.ts) y la función exportada es `proxy`,
// no `middleware` — ver node_modules/next/dist/docs/.../proxy.md.
// Rastreadores en URLs con parámetros: 403 antes de ejecutar nada. Los
// filtros de las categorías combinan en millones de URLs y ClaudeBot
// hizo 221.000 peticiones en 12 h siguiéndolas (14 sept 2026). Esas
// URLs ya van noindex/nofollow y robots las prohíbe, pero un bot tarda
// hasta un día en releer robots.txt. Las URLs limpias no se tocan.
const RASTREADOR = /bot|crawl|spider|slurp|fetch|scrapy|python-requests|curl\//i;

export async function proxy(request: NextRequest) {
  if (request.nextUrl.search && RASTREADOR.test(request.headers.get("user-agent") ?? "")) {
    return new NextResponse("Las URLs con parámetros no se rastrean. Ver /robots.txt", { status: 403 });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // No debe haber código entre createServerClient() y getUser(): es lo
  // que realmente refresca el token y reescribe las cookies si hace falta.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
