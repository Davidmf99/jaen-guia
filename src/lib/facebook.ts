import "server-only";

// Cliente mínimo de la Graph API de Meta para páginas de Facebook y
// la cuenta de Instagram Business que cuelga de ellas. Sin SDK: son
// GETs con querystring. Variables:
//   FACEBOOK_APP_ID / FACEBOOK_APP_SECRET   app en developers.facebook.com
//
// Permisos que pide el login (todos requieren App Review para
// usuarios que no sean testers de la app):
//   pages_show_list          listar las páginas del usuario
//   pages_read_engagement    leer posts de la página
//   pages_read_user_content  contenido publicado en la página
//   instagram_basic          media de la cuenta IG vinculada
export const PERMISOS = ["pages_show_list", "pages_read_engagement", "pages_read_user_content", "instagram_basic"];

const GRAPH = "https://graph.facebook.com/v21.0";

function appId() {
  const v = process.env.FACEBOOK_APP_ID;
  if (!v) throw new Error("Falta FACEBOOK_APP_ID");
  return v;
}
function appSecret() {
  const v = process.env.FACEBOOK_APP_SECRET;
  if (!v) throw new Error("Falta FACEBOOK_APP_SECRET");
  return v;
}

export function facebookConfigurado() {
  return Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

async function graph<T>(ruta: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}/${ruta}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as T & { error?: { message: string; code: number } };
  if (!res.ok || json.error) {
    throw new Error(`Graph ${ruta}: ${json.error?.message ?? res.status}`);
  }
  return json;
}

// ---------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------

export function urlLogin(redirectUri: string, state: string) {
  const u = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  u.searchParams.set("client_id", appId());
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("scope", PERMISOS.join(","));
  u.searchParams.set("response_type", "code");
  return u.toString();
}

/** code → token de usuario de larga duración (~60 días). */
export async function tokenDesdeCodigo(code: string, redirectUri: string): Promise<string> {
  const corto = await graph<{ access_token: string }>("oauth/access_token", {
    client_id: appId(),
    client_secret: appSecret(),
    redirect_uri: redirectUri,
    code,
  });
  const largo = await graph<{ access_token: string }>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId(),
    client_secret: appSecret(),
    fb_exchange_token: corto.access_token,
  });
  return largo.access_token;
}

export interface PaginaFacebook {
  id: string;
  name: string;
  /** Token de página. Obtenido con un token de usuario de larga duración, no caduca. */
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
}

/** Páginas que administra el usuario, con su Instagram vinculado. */
export async function paginasDelUsuario(tokenUsuario: string): Promise<PaginaFacebook[]> {
  const r = await graph<{ data: PaginaFacebook[] }>("me/accounts", {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "50",
    access_token: tokenUsuario,
  });
  return r.data ?? [];
}

// ---------------------------------------------------------------
// Lectura de contenido
// ---------------------------------------------------------------

export interface EventoFacebook {
  id: string;
  name: string;
  description?: string;
  start_time: string; // ISO con desfase, p.ej. "2026-09-20T22:00:00+0200"
  end_time?: string;
  is_canceled?: boolean;
  cover?: { source: string };
  place?: { name?: string; location?: { street?: string; city?: string } };
  ticket_uri?: string;
}

export async function eventosDePagina(pageId: string, tokenPagina: string): Promise<EventoFacebook[]> {
  const r = await graph<{ data: EventoFacebook[] }>(`${pageId}/events`, {
    fields: "id,name,description,start_time,end_time,is_canceled,cover,place,ticket_uri",
    time_filter: "upcoming",
    limit: "50",
    access_token: tokenPagina,
  });
  return r.data ?? [];
}

export interface PostFacebook {
  id: string;
  message?: string;
  full_picture?: string;
  permalink_url?: string;
  created_time: string;
}

export async function postsDePagina(pageId: string, tokenPagina: string, desde: Date): Promise<PostFacebook[]> {
  const r = await graph<{ data: PostFacebook[] }>(`${pageId}/posts`, {
    fields: "id,message,full_picture,permalink_url,created_time",
    since: String(Math.floor(desde.getTime() / 1000)),
    limit: "50",
    access_token: tokenPagina,
  });
  return r.data ?? [];
}

export interface MediaInstagram {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
}

/** Media de IG desde `desde`. La API no filtra por fecha: se corta en cliente. */
export async function mediaDeInstagram(igUserId: string, tokenPagina: string, desde: Date): Promise<MediaInstagram[]> {
  const r = await graph<{ data: MediaInstagram[] }>(`${igUserId}/media`, {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
    limit: "25",
    access_token: tokenPagina,
  });
  return (r.data ?? []).filter((m) => new Date(m.timestamp) > desde);
}

/** Descarga una imagen pública (CDN de Meta). */
export async function descargarImagen(url: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  return { bytes: Buffer.from(await res.arrayBuffer()), mime };
}
