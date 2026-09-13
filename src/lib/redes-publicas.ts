import "server-only";
import { descargarImagen, type MediaInstagram } from "@/lib/facebook";

// Lectura de redes PÚBLICAS sin permiso del negocio.
//
// Instagram: Business Discovery API. Con el token de la página de
// Facebook de Jaén Guía (que tiene vinculada la cuenta @jaenguia,
// tipo Business) se leen los posts públicos de cualquier cuenta
// Business/Creator por su usuario. Permisos del token:
// instagram_basic, instagram_manage_insights, pages_read_engagement.
//   INSTAGRAM_JG_USER_ID   id de la cuenta IG de Jaén Guía
//   INSTAGRAM_JG_TOKEN     token de página (larga duración)
//
// Facebook: no hay API pública. Se usa el actor de Apify
// "apify/facebook-posts-scraper" sobre la URL de la página.
//   APIFY_TOKEN
//   APIFY_FACEBOOK_ACTOR   opcional, por defecto apify~facebook-posts-scraper

const GRAPH = "https://graph.facebook.com/v21.0";

export function instagramDiscoveryConfigurado() {
  return Boolean(process.env.INSTAGRAM_JG_USER_ID && process.env.INSTAGRAM_JG_TOKEN);
}
export function apifyConfigurado() {
  return Boolean(process.env.APIFY_TOKEN);
}

/** "@barpepe", "barpepe", "https://instagram.com/barpepe/?hl=es" → "barpepe" */
export function usuarioInstagram(valor: string | null | undefined): string | null {
  if (!valor) return null;
  let v = valor.trim();
  const m = v.match(/instagram\.com\/([A-Za-z0-9_.]+)/i);
  if (m) v = m[1];
  v = v.replace(/^@/, "").replace(/\/.*$/, "");
  return /^[A-Za-z0-9_.]{1,30}$/.test(v) ? v.toLowerCase() : null;
}

/** "barpepe", "facebook.com/barpepe", "https://www.facebook.com/profile.php?id=123" → URL de página */
export function urlPaginaFacebook(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const v = valor.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) {
    return /facebook\.com\//i.test(v) ? v : null;
  }
  if (/facebook\.com\//i.test(v)) return `https://${v.replace(/^\/+/, "")}`;
  return /^[A-Za-z0-9_.-]+$/.test(v) ? `https://www.facebook.com/${v}/` : null;
}

// ---------------------------------------------------------------
// Instagram Business Discovery
// ---------------------------------------------------------------

export class CuentaNoAccesible extends Error {}

/**
 * Posts públicos de `usuario` posteriores a `desde`. Lanza
 * CuentaNoAccesible si la cuenta no existe o no es Business/Creator
 * (Meta devuelve el error 110 / "cannot find the user" en ambos casos).
 */
export async function mediaPublicoInstagram(usuario: string, desde: Date, limite = 12): Promise<MediaInstagram[]> {
  const igId = process.env.INSTAGRAM_JG_USER_ID;
  const token = process.env.INSTAGRAM_JG_TOKEN;
  if (!igId || !token) throw new Error("Falta INSTAGRAM_JG_USER_ID / INSTAGRAM_JG_TOKEN");

  const url = new URL(`${GRAPH}/${igId}`);
  url.searchParams.set(
    "fields",
    `business_discovery.username(${usuario}){media.limit(${limite}){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp}}`
  );
  url.searchParams.set("access_token", token);

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as {
    business_discovery?: { media?: { data?: MediaInstagram[] } };
    error?: { message: string; code: number; error_subcode?: number };
  };
  if (json.error) {
    // 110 = "Cannot find the user"; 100 + subcode 33 = objeto no accesible.
    if (json.error.code === 110 || json.error.error_subcode === 33) {
      throw new CuentaNoAccesible(json.error.message);
    }
    throw new Error(`Graph business_discovery(${usuario}): ${json.error.message}`);
  }
  return (json.business_discovery?.media?.data ?? []).filter((m) => new Date(m.timestamp) > desde);
}

// ---------------------------------------------------------------
// Facebook vía Apify
// ---------------------------------------------------------------

export interface PostFacebookPublico {
  id: string;
  url: string | null;
  texto: string | null;
  fecha: string;
  imagenUrl: string | null;
  paginaUrl: string;
}

interface ItemApify {
  postId?: string;
  id?: string;
  url?: string;
  text?: string;
  time?: string;
  timestamp?: number | string;
  media?: { thumbnail?: string; photo_image?: { uri?: string }; image?: { uri?: string }; url?: string }[];
  user?: { id?: string; name?: string };
  pageUrl?: string;
  inputUrl?: string;
  facebookUrl?: string;
}

/**
 * Posts recientes de varias páginas en UNA ejecución del actor (una
 * ejecución por página saldría mucho más caro). Devuelve los posts
 * agrupados por la URL de página que se pidió.
 */
export async function postsPublicosFacebook(paginas: string[], desde: Date): Promise<Map<string, PostFacebookPublico[]>> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("Falta APIFY_TOKEN");
  const actor = process.env.APIFY_FACEBOOK_ACTOR ?? "apify~facebook-posts-scraper";

  const url = new URL(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items`);
  url.searchParams.set("token", token);
  url.searchParams.set("timeout", "240");
  url.searchParams.set("format", "json");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startUrls: paginas.map((u) => ({ url: u })),
      resultsLimit: 10,
      onlyPostsNewerThan: desde.toISOString().slice(0, 10),
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const items = (await res.json()) as ItemApify[];

  const porPagina = new Map<string, PostFacebookPublico[]>();
  const normal = (u: string) => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
  const indice = new Map(paginas.map((p) => [normal(p), p]));

  for (const it of items) {
    const id = it.postId ?? it.id;
    if (!id) continue;
    const origen = it.inputUrl ?? it.pageUrl ?? it.facebookUrl ?? "";
    const clave = indice.get(normal(origen)) ?? [...indice.entries()].find(([n]) => normal(origen).startsWith(n))?.[1];
    if (!clave) continue;

    const fecha =
      it.time ?? (typeof it.timestamp === "number" ? new Date(it.timestamp * 1000).toISOString() : it.timestamp) ?? "";
    if (fecha && new Date(fecha) <= desde) continue;

    const m = it.media?.[0];
    const imagenUrl = m?.photo_image?.uri ?? m?.image?.uri ?? m?.thumbnail ?? m?.url ?? null;

    const lista = porPagina.get(clave) ?? [];
    lista.push({ id: String(id), url: it.url ?? null, texto: it.text ?? null, fecha, imagenUrl, paginaUrl: clave });
    porPagina.set(clave, lista);
  }
  return porPagina;
}

export { descargarImagen };
