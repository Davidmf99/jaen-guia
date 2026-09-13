import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Tokens de Facebook en reposo (negocios_conexiones.page_token_cifrado)
// y el "state" del OAuth. AES-256-GCM con clave derivada de
// FACEBOOK_APP_SECRET: si se filtra un volcado de la tabla sin el
// secreto, los tokens no sirven. Formato: base64url(iv | tag | datos).

function clave() {
  const secreto = process.env.FACEBOOK_APP_SECRET;
  if (!secreto) throw new Error("Falta FACEBOOK_APP_SECRET");
  return createHash("sha256").update(secreto).digest();
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), datos]).toString("base64url");
}

export function descifrar(cifrado: string): string {
  const buf = Buffer.from(cifrado, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const datos = buf.subarray(28);
  const d = createDecipheriv("aes-256-gcm", clave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(datos), d.final()]).toString("utf8");
}

/** Firma un objeto para el `state` del OAuth: base64url(json).firma */
export function firmarEstado(obj: Record<string, unknown>): string {
  const cuerpo = Buffer.from(JSON.stringify(obj)).toString("base64url");
  const firma = createHmac("sha256", clave()).update(cuerpo).digest("base64url");
  return `${cuerpo}.${firma}`;
}

export function leerEstado<T>(estado: string | null): T | null {
  if (!estado) return null;
  const [cuerpo, firma] = estado.split(".");
  if (!cuerpo || !firma) return null;
  const esperada = createHmac("sha256", clave()).update(cuerpo).digest("base64url");
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
