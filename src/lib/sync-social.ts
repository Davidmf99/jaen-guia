import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { descifrar } from "@/lib/cifrado";
import { eventosDePagina, postsDePagina, mediaDeInstagram, descargarImagen } from "@/lib/facebook";
import { procesarEntradaBuzon, insertarBorrador, BUCKET_BUZON, type NegocioBuzon } from "@/lib/buzon";
import { enviarCorreos, emailsDeNegocio, correoBorradoresNuevos } from "@/lib/email";

// Lee la página de Facebook (y el Instagram vinculado) de un negocio y
// deja como borrador lo que parezca un evento. Lo llama el cron diario
// y el botón "Revisar ahora" del panel.
//
//   · Eventos de Facebook: ya vienen con título, fecha y foto. Entran
//     directos, sin Claude. Dedup por fuente_url (url_canonica única).
//   · Posts de la página e IG media: texto + imagen → lib/buzon
//     (Claude). Dedup por (canal, id del post) en buzon_mensajes.

export interface ConexionSync {
  negocio_id: string;
  page_id: string;
  page_nombre: string | null;
  page_token_cifrado: string;
  ig_user_id: string | null;
  ultima_sync: string;
  negocio: NegocioBuzon;
}

export interface ResumenSync {
  negocio: string;
  eventosFb: number;
  postsFb: number;
  ig: number;
  borradoresNuevos: number;
  error?: string;
}

export const SELECT_CONEXION =
  "negocio_id, page_id, page_nombre, page_token_cifrado, ig_user_id, ultima_sync, negocio:negocios!inner(id, slug, nombre, categoria_id, municipio_id)";

export async function sincronizarConexion(admin: SupabaseClient, c: ConexionSync): Promise<ResumenSync> {
  const resumen: ResumenSync = { negocio: c.negocio.slug, eventosFb: 0, postsFb: 0, ig: 0, borradoresNuevos: 0 };
  const inicioRun = new Date();
  const desde = new Date(c.ultima_sync);

  let token: string;
  try {
    token = descifrar(c.page_token_cifrado);
  } catch {
    return { ...resumen, error: "Token ilegible" };
  }

  try {
    // 1. Eventos de Facebook (estructurados)
    const eventos = await eventosDePagina(c.page_id, token);
    resumen.eventosFb = eventos.length;
    if (eventos.length > 0) {
      const urls = eventos.map((e) => urlEventoFb(e.id));
      const { data: yaImportados } = await admin
        .from("eventos")
        .select("fuente_url")
        .eq("negocio_id", c.negocio.id)
        .in("fuente_url", urls);
      const vistos = new Set((yaImportados ?? []).map((r) => r.fuente_url as string));

      for (const ev of eventos) {
        if (ev.is_canceled || vistos.has(urlEventoFb(ev.id))) continue;
        const inicio = new Date(ev.start_time);
        if (Number.isNaN(inicio.getTime())) continue;
        const fin = ev.end_time ? new Date(ev.end_time) : null;

        // La portada del evento es una URL del CDN de Meta que caduca:
        // se archiva en el bucket para que la agenda no se quede sin foto.
        const imagen = ev.cover?.source ? await archivarImagen(admin, c.negocio.id, `facebook-event-${ev.id}`, ev.cover.source) : null;

        const lugar = ev.place?.name && ev.place.name !== c.page_nombre ? ev.place.name : null;
        const r = await insertarBorrador(admin, {
          titulo: ev.name,
          descripcion: ev.description?.trim() || null,
          negocio: c.negocio,
          imagen,
          fecha_inicio: inicio.toISOString(),
          fecha_fin: fin && !Number.isNaN(fin.getTime()) && fin > inicio ? fin.toISOString() : null,
          es_todo_el_dia: false,
          es_gratis: false,
          precio_texto: null,
          lugar_nombre: lugar,
          origen: "facebook",
          fuente_nombre: "Facebook",
          fuente_url: urlEventoFb(ev.id),
          confianza: "alta",
        });
        if (r.estado === "borrador") resumen.borradoresNuevos++;
      }
    }

    // 2. Publicaciones de la página
    const posts = await postsDePagina(c.page_id, token, desde);
    resumen.postsFb = posts.length;
    for (const post of posts) {
      // Sin imagen y sin un número en el texto no hay fecha que leer:
      // se ahorra la llamada a Claude.
      if (!post.full_picture && !/\d/.test(post.message ?? "")) continue;
      const imagen = post.full_picture ? await descargarImagen(post.full_picture) : null;
      const salida = await procesarEntradaBuzon(admin, {
        canal: "facebook",
        externoId: post.id,
        remitente: c.page_id,
        remitenteNombre: c.page_nombre,
        negocio: c.negocio,
        texto: post.message ?? null,
        imagen,
        fuenteUrl: post.permalink_url ?? null,
      });
      if (salida.estado === "borrador") resumen.borradoresNuevos++;
    }

    // 3. Instagram
    if (c.ig_user_id) {
      const media = await mediaDeInstagram(c.ig_user_id, token, desde);
      resumen.ig = media.length;
      for (const m of media) {
        const urlImagen = m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
        const imagen = urlImagen ? await descargarImagen(urlImagen) : null;
        const salida = await procesarEntradaBuzon(admin, {
          canal: "instagram",
          externoId: m.id,
          remitente: c.ig_user_id,
          remitenteNombre: c.page_nombre,
          negocio: c.negocio,
          texto: m.caption ?? null,
          imagen,
          fuenteUrl: m.permalink ?? null,
        });
        if (salida.estado === "borrador") resumen.borradoresNuevos++;
      }
    }

    await admin
      .from("negocios_conexiones")
      .update({ ultima_sync: inicioRun.toISOString(), ultimo_error: null })
      .eq("negocio_id", c.negocio_id)
      .eq("plataforma", "facebook");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    resumen.error = msg;
    await admin
      .from("negocios_conexiones")
      .update({ ultimo_error: msg.slice(0, 300) })
      .eq("negocio_id", c.negocio_id)
      .eq("plataforma", "facebook");
  }

  if (resumen.borradoresNuevos > 0) {
    await avisarMiembros(admin, c.negocio, resumen.borradoresNuevos);
  }
  return resumen;
}

function urlEventoFb(id: string) {
  return `https://www.facebook.com/events/${id}`;
}

async function archivarImagen(admin: SupabaseClient, negocioId: string, nombre: string, url: string): Promise<string | null> {
  const img = await descargarImagen(url);
  if (!img) return null;
  const ext = img.mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const path = `${negocioId}/${nombre}.${ext}`;
  const { error } = await admin.storage.from(BUCKET_BUZON).upload(path, img.bytes, { contentType: img.mime, upsert: true });
  if (error) return null;
  return admin.storage.from(BUCKET_BUZON).getPublicUrl(path).data.publicUrl;
}

// Correo a cada miembro aprobado: "tienes N eventos para revisar".
async function avisarMiembros(admin: SupabaseClient, negocio: NegocioBuzon, cuantos: number) {
  await enviarCorreos(await emailsDeNegocio(admin, negocio.id), correoBorradoresNuevos(negocio, cuantos));
}
