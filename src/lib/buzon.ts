import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extraerEvento, type EventoExtraido } from "@/lib/extraccion-evento";
import { isoDesdeHoraJaen, isoDiaCompletoJaen } from "@/lib/eventos";

// Tramo común de todas las entradas (WhatsApp, Facebook, Instagram):
// guardar lo recibido en buzon_mensajes, leerlo con Claude y dejar un
// evento en borrador colgado del negocio. Quien llama decide de dónde
// viene el contenido; aquí no se sabe nada de webhooks ni de tokens.

export const BUCKET_BUZON = "buzon";
const UNIQUE_VIOLATION = "23505";

export type Canal = "whatsapp" | "facebook" | "instagram";

export type ResultadoBuzon =
  | "repetido"
  | "no_es_evento"
  | "borrador"
  | "duplicado"
  | "error";

export interface NegocioBuzon {
  id: string;
  slug: string;
  nombre: string;
  categoria_id: string | null;
  municipio_id: string | null;
}

export interface EntradaBuzon {
  canal: Canal;
  /** Id en la plataforma: wamid, id del post, id del media. */
  externoId: string;
  /** Teléfono (WhatsApp) o id de página/cuenta (FB/IG). */
  remitente: string;
  remitenteNombre?: string | null;
  negocio: NegocioBuzon;
  texto?: string | null;
  /** Imagen ya descargada. Se archiva en el bucket antes de llamar a Claude. */
  imagen?: { bytes: Buffer; mime: string } | null;
  /** Permalink del post original; alimenta eventos.fuente_url (dedup). */
  fuenteUrl?: string | null;
  fuenteNombre?: string | null;
}

export interface SalidaBuzon {
  estado: ResultadoBuzon;
  extraido?: EventoExtraido | null;
  eventoId?: string;
  fechaInicio?: string;
}

/**
 * Procesa una entrada. Nunca lanza: el estado 'error' lleva el motivo
 * en buzon_mensajes.error. Un externoId repetido devuelve 'repetido'
 * sin tocar nada (idempotencia ante reintentos y re-sincronizaciones).
 */
export async function procesarEntradaBuzon(admin: SupabaseClient, e: EntradaBuzon): Promise<SalidaBuzon> {
  const { data: fila, error: errInsert } = await admin
    .from("buzon_mensajes")
    .insert({
      canal: e.canal,
      mensaje_externo_id: e.externoId,
      remitente: e.remitente,
      remitente_nombre: e.remitenteNombre ?? null,
      texto: e.texto ?? null,
      imagen_mime: e.imagen?.mime ?? null,
      negocio_id: e.negocio.id,
      estado: "recibido",
    })
    .select("id")
    .single();

  if (errInsert) {
    if (errInsert.code === UNIQUE_VIOLATION) return { estado: "repetido" };
    console.error("[buzon] insert", errInsert);
    return { estado: "error" };
  }
  const buzonId = fila.id as string;

  const cerrar = async (estado: ResultadoBuzon, extra: Record<string, unknown> = {}): Promise<SalidaBuzon> => {
    await admin
      .from("buzon_mensajes")
      .update({ estado, procesado_en: new Date().toISOString(), ...extra })
      .eq("id", buzonId);
    return { estado, extraido: (extra.extraccion as EventoExtraido | null) ?? null, eventoId: extra.evento_id as string | undefined };
  };

  if (!e.imagen && !e.texto?.trim()) {
    return cerrar("no_es_evento", { error: "Sin texto ni imagen." });
  }

  // Archivar el cartel antes de Claude: si Claude falla, no se pierde.
  let imagenPath: string | null = null;
  if (e.imagen) {
    const ext = e.imagen.mime.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
    imagenPath = `${e.negocio.id}/${e.canal}-${e.externoId.replace(/[^a-zA-Z0-9_.-]/g, "_")}.${ext}`;
    const { error: errSubida } = await admin.storage
      .from(BUCKET_BUZON)
      .upload(imagenPath, e.imagen.bytes, { contentType: e.imagen.mime, upsert: true });
    if (errSubida) return cerrar("error", { error: `Subida de imagen: ${errSubida.message}` });
    await admin.from("buzon_mensajes").update({ imagen_path: imagenPath }).eq("id", buzonId);
  }

  let extraido: EventoExtraido | null;
  try {
    extraido = await extraerEvento({ negocioNombre: e.negocio.nombre, texto: e.texto, imagen: e.imagen });
  } catch (err) {
    return cerrar("error", { error: `Claude: ${String(err)}` });
  }
  if (!extraido || !extraido.es_evento) {
    return cerrar("no_es_evento", { extraccion: extraido });
  }

  const fechas = fechasDesdeExtraccion(extraido);
  if (!fechas) {
    return cerrar("error", { extraccion: extraido, error: `Fecha ilegible: ${extraido.fecha_inicio}` });
  }

  const imagenUrl = imagenPath ? admin.storage.from(BUCKET_BUZON).getPublicUrl(imagenPath).data.publicUrl : null;

  const resultado = await insertarBorrador(admin, {
    titulo: extraido.titulo,
    descripcion: extraido.descripcion || null,
    negocio: e.negocio,
    imagen: imagenUrl,
    fecha_inicio: fechas.inicio,
    fecha_fin: fechas.fin,
    es_todo_el_dia: extraido.es_todo_el_dia,
    es_gratis: extraido.es_gratis,
    precio_texto: extraido.es_gratis ? null : extraido.precio_texto || null,
    lugar_nombre: extraido.lugar_nombre || null,
    origen: e.canal,
    fuente_nombre: e.fuenteNombre ?? nombreCanal(e.canal),
    fuente_url: e.fuenteUrl ?? null,
    confianza: extraido.confianza,
  });

  if (resultado.estado === "duplicado") return cerrar("duplicado", { extraccion: extraido });
  if (resultado.estado === "error") return cerrar("error", { extraccion: extraido, error: resultado.error });
  const salida = await cerrar("borrador", { extraccion: extraido, evento_id: resultado.eventoId });
  return { ...salida, fechaInicio: fechas.inicio };
}

function nombreCanal(c: Canal) {
  return c === "whatsapp" ? "WhatsApp" : c === "facebook" ? "Facebook" : "Instagram";
}

/** Misma conversión que el formulario del panel: hora de Jaén → ISO UTC. */
export function fechasDesdeExtraccion(x: EventoExtraido): { inicio: string; fin: string | null } | null {
  const inicio = x.es_todo_el_dia
    ? isoDiaCompletoJaen(x.fecha_inicio.slice(0, 10))
    : isoDesdeHoraJaen(x.fecha_inicio.slice(0, 16));
  if (!inicio) return null;
  let fin: string | null = null;
  if (x.fecha_fin) {
    fin = x.es_todo_el_dia ? isoDiaCompletoJaen(x.fecha_fin.slice(0, 10)) : isoDesdeHoraJaen(x.fecha_fin.slice(0, 16));
    if (fin && fin < inicio) fin = null;
  }
  return { inicio, fin };
}

export interface BorradorNuevo {
  titulo: string;
  descripcion: string | null;
  negocio: NegocioBuzon;
  imagen: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  es_todo_el_dia: boolean;
  es_gratis: boolean;
  precio_texto: string | null;
  lugar_nombre: string | null;
  origen: Canal;
  fuente_nombre: string | null;
  fuente_url: string | null;
  confianza?: "alta" | "media" | "baja" | null;
}

// Con BUZON_AUTOPUBLICAR=1, lo que Claude lee con confianza alta sale
// publicado directamente; el resto espera al admin/dueño. Apagado por
// defecto: mejor un borrador de más que un concierto con la hora mal.
function estadoInicial(confianza: BorradorNuevo["confianza"]) {
  return process.env.BUZON_AUTOPUBLICAR === "1" && confianza === "alta" ? "publicado" : "borrador";
}

/**
 * Inserta un evento en borrador. También lo usa el cron para los
 * eventos de Facebook, que vienen estructurados y no pasan por Claude.
 * Duplicado = salta uq_eventos_huella o uq_eventos_url_canonica.
 */
export async function insertarBorrador(
  admin: SupabaseClient,
  b: BorradorNuevo
): Promise<{ estado: "borrador"; eventoId: string } | { estado: "duplicado" } | { estado: "error"; error: string }> {
  const { data, error } = await admin
    .from("eventos")
    .insert({
      titulo: b.titulo.slice(0, 120),
      descripcion: b.descripcion,
      negocio_id: b.negocio.id,
      municipio_id: b.negocio.municipio_id,
      categoria_id: b.negocio.categoria_id,
      imagen: b.imagen,
      fecha_inicio: b.fecha_inicio,
      fecha_fin: b.fecha_fin,
      es_todo_el_dia: b.es_todo_el_dia,
      es_gratis: b.es_gratis,
      precio_texto: b.precio_texto,
      lugar_nombre: b.lugar_nombre,
      origen: b.origen,
      estado: estadoInicial(b.confianza),
      confianza: b.confianza ?? null,
      fuente_nombre: b.fuente_nombre,
      fuente_url: b.fuente_url,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { estado: "duplicado" };
    return { estado: "error", error: `Insert evento: ${error.message}` };
  }
  return { estado: "borrador", eventoId: data.id as string };
}
