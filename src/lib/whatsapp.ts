import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Cliente mínimo de la WhatsApp Cloud API de Meta (sin SDK: son tres
// peticiones HTTP). Variables:
//   WHATSAPP_VERIFY_TOKEN     cadena que se pega en el panel de Meta al
//                             registrar el webhook; Meta la devuelve en
//                             el GET de verificación.
//   WHATSAPP_APP_SECRET       "App secret" de la app de Meta: firma cada
//                             POST del webhook (X-Hub-Signature-256).
//   WHATSAPP_ACCESS_TOKEN     token de sistema (permanente) con
//                             whatsapp_business_messaging.
//   WHATSAPP_PHONE_NUMBER_ID  id del número desde el que se responde.

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Comprueba la firma HMAC-SHA256 del cuerpo crudo. Sin esto cualquiera
 * que conozca la URL podría meter "eventos" en el buzón.
 */
export function firmaValida(cuerpoCrudo: string, cabecera: string | null): boolean {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto || !cabecera) return false;
  const esperada = "sha256=" + createHmac("sha256", secreto).update(cuerpoCrudo, "utf8").digest("hex");
  const a = Buffer.from(esperada);
  const b = Buffer.from(cabecera);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Forma del webhook de mensajes entrantes (solo los campos que se usan).
export interface MensajeWhatsApp {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256?: string; caption?: string };
}

interface CuerpoWebhook {
  object?: string;
  entry?: {
    changes?: {
      field?: string;
      value?: {
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: MensajeWhatsApp[];
      };
    }[];
  }[];
}

/** Aplana el JSON del webhook a una lista de (mensaje, nombre del contacto). */
export function extraerMensajes(cuerpo: unknown): { mensaje: MensajeWhatsApp; nombre: string | null }[] {
  const b = cuerpo as CuerpoWebhook;
  if (b?.object !== "whatsapp_business_account") return [];
  const salida: { mensaje: MensajeWhatsApp; nombre: string | null }[] = [];
  for (const entry of b.entry ?? []) {
    for (const cambio of entry.changes ?? []) {
      if (cambio.field !== "messages") continue;
      const nombres = new Map(
        (cambio.value?.contacts ?? []).map((c) => [c.wa_id ?? "", c.profile?.name ?? null])
      );
      for (const m of cambio.value?.messages ?? []) {
        salida.push({ mensaje: m, nombre: nombres.get(m.from) ?? null });
      }
    }
  }
  return salida;
}

function token() {
  const t = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!t) throw new Error("Falta WHATSAPP_ACCESS_TOKEN");
  return t;
}

/**
 * Descarga un adjunto. Meta no da la URL en el webhook: primero se pide
 * la ficha del media (URL temporal) y luego el binario, ambos con token.
 */
export async function descargarMedia(mediaId: string): Promise<{ bytes: Buffer; mime: string }> {
  const ficha = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!ficha.ok) throw new Error(`Meta media ${ficha.status}: ${await ficha.text()}`);
  const { url, mime_type } = (await ficha.json()) as { url: string; mime_type: string };

  const bin = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!bin.ok) throw new Error(`Meta descarga ${bin.status}`);
  return { bytes: Buffer.from(await bin.arrayBuffer()), mime: mime_type };
}

/** Responde con texto al remitente. Falla en silencio: la respuesta es cortesía, no el dato. */
export async function enviarTexto(para: string, texto: string): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneId) {
    console.warn("[whatsapp] sin WHATSAPP_PHONE_NUMBER_ID; no se responde a", para);
    return;
  }
  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: para,
        type: "text",
        text: { body: texto, preview_url: true },
      }),
    });
    if (!res.ok) console.error(`[whatsapp] envío ${res.status}: ${await res.text()}`);
  } catch (err) {
    console.error("[whatsapp] envío falló:", err);
  }
}
