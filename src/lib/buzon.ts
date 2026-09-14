import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extraerEvento, type EventoExtraido } from "@/lib/extraccion-evento";
import { isoDesdeHoraJaen, isoDiaCompletoJaen } from "@/lib/eventos";
import { municipioDeJaen, normalizarMunicipio } from "@/lib/municipios-jaen";

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
  /** Null cuando viene de una cuenta fuente (fuentes_redes): el evento no cuelga de ningún negocio. */
  negocio: NegocioBuzon | null;
  fuenteId?: string | null;
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
      negocio_id: e.negocio?.id ?? null,
      fuente_id: e.fuenteId ?? null,
      fuente_url: e.fuenteUrl ?? null,
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
    imagenPath = `${e.negocio?.id ?? `fuente-${e.fuenteId ?? "x"}`}/${e.canal}-${e.externoId.replace(/[^a-zA-Z0-9_.-]/g, "_")}.${ext}`;
    const { error: errSubida } = await admin.storage
      .from(BUCKET_BUZON)
      .upload(imagenPath, e.imagen.bytes, { contentType: e.imagen.mime, upsert: true });
    if (errSubida) return cerrar("error", { error: `Subida de imagen: ${errSubida.message}` });
    await admin.from("buzon_mensajes").update({ imagen_path: imagenPath }).eq("id", buzonId);
  }

  let extraido: EventoExtraido | null;
  try {
    extraido = await extraerEvento({
      negocioNombre: e.negocio?.nombre ?? e.remitenteNombre ?? e.remitente,
      esFuente: !e.negocio,
      texto: e.texto,
      imagen: e.imagen,
    });
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
  // Lo que ya pasó no va a la agenda: un agregador leído con 30 días de
  // ventana trae conciertos de hace tres semanas.
  if (new Date(fechas.fin ?? fechas.inicio).getTime() < Date.now() - 86400000) {
    return cerrar("no_es_evento", { extraccion: extraido, error: `Ya pasó: ${extraido.fecha_inicio}` });
  }
  // Fuera de la provincia, fuera de la guía. Si no dice localidad,
  // se asume la del negocio (o la capital, si no hay negocio).
  let municipioId: string | null | undefined;
  if (extraido.municipio) {
    const oficial = municipioDeJaen(extraido.municipio);
    if (!oficial) return cerrar("no_es_evento", { extraccion: extraido, error: `Fuera de Jaén: ${extraido.municipio}` });
    municipioId = await idDeMunicipio(admin, oficial);
  }

  const imagenUrl = imagenPath ? admin.storage.from(BUCKET_BUZON).getPublicUrl(imagenPath).data.publicUrl : null;

  // De una cuenta fuente: si el cartel nombra un sitio que está en la
  // guía, el evento cuelga de él (sale en su ficha y con su categoría).
  const negocio = e.negocio ?? (extraido.lugar_nombre ? await negocioPorNombre(admin, extraido.lugar_nombre) : null);

  const resultado = await insertarBorrador(admin, {
    titulo: extraido.titulo,
    descripcion: extraido.descripcion || null,
    negocio,
    imagen: imagenUrl,
    fecha_inicio: fechas.inicio,
    fecha_fin: fechas.fin,
    es_todo_el_dia: extraido.es_todo_el_dia,
    es_gratis: extraido.es_gratis,
    precio_texto: extraido.es_gratis ? null : extraido.precio_texto || null,
    lugar_nombre: extraido.lugar_nombre || null,
    municipio_id: municipioId,
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

/**
 * Vuelve a leer un mensaje ya guardado (texto + imagen del bucket) con
 * el prompt actual, sin tocar Apify ni Meta. Si el mensaje ya había
 * generado un evento y este no ha sido editado a mano (sigue con su
 * origen y su fuente), se sustituye; si ahora no es evento, se borra.
 * Sirve para aplicar mejoras del prompt a lo que ya entró.
 */
export async function reprocesarMensaje(admin: SupabaseClient, buzonId: string): Promise<SalidaBuzon> {
  const { data: m } = await admin
    .from("buzon_mensajes")
    .select("id, canal, mensaje_externo_id, remitente, remitente_nombre, texto, imagen_path, imagen_mime, negocio_id, fuente_id, evento_id, fuente_url, negocio:negocios(id, slug, nombre, categoria_id, municipio_id)")
    .eq("id", buzonId)
    .maybeSingle<{
      id: string; canal: Canal; mensaje_externo_id: string; remitente: string; remitente_nombre: string | null;
      texto: string | null; imagen_path: string | null; imagen_mime: string | null; negocio_id: string | null;
      fuente_id: string | null; evento_id: string | null; fuente_url: string | null; negocio: NegocioBuzon | null;
    }>();
  if (!m || (!m.negocio && !m.fuente_id)) return { estado: "error" };

  let imagen: { bytes: Buffer; mime: string } | null = null;
  if (m.imagen_path && m.imagen_mime) {
    const { data } = await admin.storage.from(BUCKET_BUZON).download(m.imagen_path);
    if (data) imagen = { bytes: Buffer.from(await data.arrayBuffer()), mime: m.imagen_mime };
  }

  // Fuera lo que generó la lectura anterior. Solo si sigue siendo
  // "nuestro" (mismo origen): un evento editado desde el panel cambia
  // de origen y se respeta.
  let fuenteUrl = m.fuente_url;
  if (m.evento_id) {
    const { data: ev } = await admin.from("eventos").select("origen, fuente_url").eq("id", m.evento_id).maybeSingle();
    fuenteUrl ??= ev?.fuente_url ?? null;
    if (ev?.origen === m.canal) await admin.from("eventos").delete().eq("id", m.evento_id);
  }
  await admin.from("buzon_mensajes").delete().eq("id", m.id);

  return procesarEntradaBuzon(admin, {
    canal: m.canal,
    externoId: m.mensaje_externo_id,
    remitente: m.remitente,
    remitenteNombre: m.remitente_nombre,
    negocio: m.negocio,
    fuenteId: m.fuente_id,
    texto: m.texto,
    imagen,
    fuenteUrl,
  });
}

const plano = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Negocio activo cuyo nombre coincide con el lugar del cartel. Solo
 * coincidencia clara (mismo nombre normalizado, o el nombre del negocio
 * contenido en el lugar con 6+ letras): "Sala La Paca" ↔ "SALA LA PACA".
 * Con dudas, null: mejor un evento sin ficha que en la ficha equivocada.
 */
export async function negocioPorNombre(admin: SupabaseClient, lugar: string): Promise<NegocioBuzon | null> {
  const buscado = plano(lugar);
  if (buscado.length < 4) return null;
  const { data } = await admin
    .from("negocios")
    .select("id, slug, nombre, categoria_id, municipio_id")
    .eq("activo", true)
    .ilike("nombre", `%${lugar.replace(/[%_]/g, "").trim().slice(0, 40)}%`)
    .limit(5)
    .returns<NegocioBuzon[]>();
  const candidatos = (data ?? []).filter((n) => {
    const nombre = plano(n.nombre);
    return nombre === buscado || (nombre.length >= 6 && buscado.includes(nombre)) || (buscado.length >= 6 && nombre.includes(buscado));
  });
  return candidatos.length === 1 ? candidatos[0] : null;
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
  negocio: NegocioBuzon | null;
  imagen: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  es_todo_el_dia: boolean;
  es_gratis: boolean;
  precio_texto: string | null;
  lugar_nombre: string | null;
  /** Si el cartel dice la localidad; si no, la del negocio o el default (capital). */
  municipio_id?: string | null;
  origen: Canal;
  fuente_nombre: string | null;
  fuente_url: string | null;
  confianza?: "alta" | "media" | "baja" | null;
}

// Publicación automática (decisión de 14 sept 2026: cero trabajo para
// David). Lo leído con confianza alta o media se publica; lo de baja
// queda en borrador por si alguien quiere mirarlo, sin obligación. El
// filtro de ruido está en el prompt (extraccion-evento.ts). Con
// BUZON_AUTOPUBLICAR=0 vuelve todo a borrador.
function estadoInicial(confianza: BorradorNuevo["confianza"]) {
  if (process.env.BUZON_AUTOPUBLICAR === "0") return "borrador";
  return confianza === "alta" || confianza === "media" ? "publicado" : "borrador";
}

/**
 * Inserta un evento en borrador. También lo usa el cron para los
 * eventos de Facebook, que vienen estructurados y no pasan por Claude.
 * Duplicado = salta uq_eventos_huella o uq_eventos_url_canonica.
 */
/** Fila de `municipios` para un nombre oficial, creándola si no existe (como sync-events). */
async function idDeMunicipio(admin: SupabaseClient, nombre: string): Promise<string | null> {
  const slug = normalizarMunicipio(nombre).replace(/ /g, "-");
  const { data } = await admin.from("municipios").select("id").eq("slug", slug).maybeSingle();
  if (data?.id) return data.id as string;
  const { data: nuevo } = await admin.from("municipios").upsert({ nombre, slug }, { onConflict: "slug" }).select("id").maybeSingle();
  return (nuevo?.id as string | undefined) ?? null;
}

const palabras = (t: string) => new Set(plano(t).split(" ").filter((p) => p.length >= 4));

/**
 * La huella de la base solo pilla el mismo título el mismo día. Dos
 * posts del mismo festival con títulos distintos ("San Lucas & Roll
 * 2026" y "San Lucas & Roll 2026: M-Clan, Burning...") se le escapan:
 * mismo día, mismo sitio (negocio o lugar) y la mitad de las palabras
 * en común, es el mismo evento.
 */
async function pareceRepetido(admin: SupabaseClient, b: BorradorNuevo): Promise<boolean> {
  const dia = b.fecha_inicio.slice(0, 10);
  const { data } = await admin
    .from("eventos")
    .select("titulo, negocio_id, lugar_nombre")
    .gte("fecha_inicio", `${dia}T00:00:00Z`)
    .lt("fecha_inicio", `${dia}T23:59:59Z`)
    .neq("estado", "borrador")
    .limit(50);
  const mias = palabras(b.titulo);
  const contiene = (a: string, c: string) => a.length >= 6 && c.length >= 6 && (a.includes(c) || c.includes(a));
  return (data ?? []).some((e) => {
    const suyas = palabras(e.titulo);
    const comunes = [...mias].filter((p) => suyas.has(p)).length;
    if (!comunes) return false;
    const parecido = comunes / Math.min(mias.size, suyas.size);
    // "La Alameda" y "Auditorio Municipal La Alameda" son el mismo sitio.
    const mismoSitio =
      (b.negocio && e.negocio_id === b.negocio.id) ||
      (b.lugar_nombre && e.lugar_nombre && contiene(plano(e.lugar_nombre), plano(b.lugar_nombre)));
    // Mismo sitio y la mitad del título, o títulos casi iguales el mismo día.
    return (mismoSitio && parecido >= 0.5) || parecido >= 0.8;
  });
}

export async function insertarBorrador(
  admin: SupabaseClient,
  b: BorradorNuevo
): Promise<{ estado: "borrador"; eventoId: string } | { estado: "duplicado" } | { estado: "error"; error: string }> {
  if (await pareceRepetido(admin, b)) return { estado: "duplicado" };
  const { data, error } = await admin
    .from("eventos")
    .insert({
      titulo: b.titulo.slice(0, 120),
      descripcion: b.descripcion,
      negocio_id: b.negocio?.id ?? null,
      // Sin negocio ni localidad, el municipio lo pone la base (capital).
      ...(b.municipio_id ? { municipio_id: b.municipio_id } : b.negocio ? { municipio_id: b.negocio.municipio_id } : {}),
      ...(b.negocio ? { categoria_id: b.negocio.categoria_id } : {}),
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
