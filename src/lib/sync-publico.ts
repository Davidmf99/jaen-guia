import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { procesarEntradaBuzon, type NegocioBuzon } from "@/lib/buzon";
import {
  usuarioInstagram,
  urlPaginaFacebook,
  mediaPublicoInstagram,
  mediaPublicoInstagramApify,
  postsPublicosFacebook,
  postsPublicosGruposFacebook,
  descargarImagen,
  instagramDiscoveryConfigurado,
  apifyConfigurado,
  CuentaNoAccesible,
  type MediaInstagram,
} from "@/lib/redes-publicas";

// Recorre los negocios con Instagram/Facebook rellenado y lee sus
// publicaciones públicas sin que el negocio haya hecho nada. Lo que
// parece un evento entra como borrador (lib/buzon) para que el admin
// lo confirme en /admin/borradores.
//
// Por lotes: cada pasada coge los N negocios con la sincronización
// más antigua. Con 400 negocios y un cron cada 3 h, lote de 60 =
// cada negocio se lee ~cada 20 h. El cron de Vercel Hobby es diario:
// entonces lote grande (200) y cada negocio cada 2 días.

interface NegocioRed {
  id: string;
  slug: string;
  nombre: string;
  categoria_id: string | null;
  municipio_id: string | null;
  instagram: string | null;
  facebook: string | null;
}

interface Seguimiento {
  negocio_id: string;
  plataforma: "instagram" | "facebook";
  ultima_sync: string;
  desactivado: boolean;
}

export interface ResumenPublico {
  plataforma: "instagram" | "facebook" | "fuentes";
  negocios: number;
  publicaciones: number;
  borradoresNuevos: number;
  desactivados: string[];
  errores: string[];
}

// Al dar de alta el seguimiento no se lee el histórico: solo lo que
// publiquen a partir de ahora (menos 7 días, por si el cartel del
// finde ya estaba subido).
const DIAS_INICIALES = 7;

async function negociosConRed(
  admin: SupabaseClient,
  plataforma: "instagram" | "facebook",
  lote: number,
  resolver: (valor: string | null) => string | null
) {
  const columna = plataforma;
  // Las tiendas no publican eventos (y Apify cobra por post leído):
  // solo comer/beber, ocio, cultura y naturaleza.
  const { data: negocios } = await admin
    .from("negocios")
    .select("id, slug, nombre, categoria_id, municipio_id, instagram, facebook, categoria:categorias!inner(tipo)")
    .eq("activo", true)
    .neq("categorias.tipo", "tienda")
    .not(columna, "is", null)
    .neq(columna, "")
    .returns<NegocioRed[]>();

  const { data: seguimientos } = await admin
    .from("negocios_seguimiento")
    .select("negocio_id, plataforma, ultima_sync, desactivado, identificador")
    .eq("plataforma", plataforma)
    .returns<(Seguimiento & { identificador: string | null })[]>();
  const porNegocio = new Map((seguimientos ?? []).map((s) => [s.negocio_id, s]));

  const inicial = new Date(Date.now() - DIAS_INICIALES * 86400000).toISOString();
  return (negocios ?? [])
    .map((n) => {
      const s = porNegocio.get(n.id);
      // Si el admin corrigió el dato en la ficha, el identificador ya no
      // coincide con el que falló: se vuelve a intentar.
      const corregido = s?.desactivado && s.identificador !== resolver(n[plataforma]);
      return { negocio: n, desde: s?.ultima_sync ?? inicial, desactivado: (s?.desactivado ?? false) && !corregido };
    })
    .filter((x) => !x.desactivado)
    .sort((a, b) => a.desde.localeCompare(b.desde))
    .slice(0, lote);
}

async function marcar(
  admin: SupabaseClient,
  negocioId: string,
  plataforma: "instagram" | "facebook",
  campos: { identificador?: string | null; ultima_sync?: string; ultimo_error?: string | null; desactivado?: boolean }
) {
  await admin
    .from("negocios_seguimiento")
    .upsert({ negocio_id: negocioId, plataforma, ...campos }, { onConflict: "negocio_id,plataforma" });
}

// ---------------------------------------------------------------
// Instagram
// ---------------------------------------------------------------

/** Un post → buzón. Devuelve si ha creado borrador. */
async function procesarMediaInstagram(admin: SupabaseClient, negocio: NegocioRed, usuario: string, m: MediaInstagram) {
  const urlImagen = m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url;
  const imagen = urlImagen ? await descargarImagen(urlImagen) : null;
  const salida = await procesarEntradaBuzon(admin, {
    canal: "instagram",
    externoId: m.id,
    remitente: usuario,
    remitenteNombre: negocio.nombre,
    negocio: negocio as NegocioBuzon,
    texto: m.caption ?? null,
    imagen,
    fuenteUrl: m.permalink ?? null,
  });
  return salida.estado === "borrador";
}

export async function sincronizarInstagramPublico(admin: SupabaseClient, lote = 60): Promise<ResumenPublico> {
  const r: ResumenPublico = { plataforma: "instagram", negocios: 0, publicaciones: 0, borradoresNuevos: 0, desactivados: [], errores: [] };
  if (!instagramDiscoveryConfigurado() && !apifyConfigurado()) {
    r.errores.push("Instagram sin configurar: ni Business Discovery (INSTAGRAM_JG_USER_ID / INSTAGRAM_JG_TOKEN) ni Apify (APIFY_TOKEN).");
    return r;
  }

  const pendientes = await negociosConRed(admin, "instagram", lote, usuarioInstagram);
  const validos: { negocio: NegocioRed; desde: string; usuario: string }[] = [];
  for (const { negocio, desde } of pendientes) {
    const usuario = usuarioInstagram(negocio.instagram);
    if (!usuario) {
      await marcar(admin, negocio.id, "instagram", { identificador: null, desactivado: true, ultimo_error: `Usuario ilegible: ${negocio.instagram}` });
      r.desactivados.push(negocio.slug);
      continue;
    }
    validos.push({ negocio, desde, usuario });
  }
  if (validos.length === 0) return r;
  r.negocios = validos.length;

  if (instagramDiscoveryConfigurado()) {
    // Vía oficial: una llamada por cuenta.
    for (const { negocio, desde, usuario } of validos) {
      const inicioRun = new Date().toISOString();
      try {
        const media = await mediaPublicoInstagram(usuario, new Date(desde));
        r.publicaciones += media.length;
        for (const m of media) if (await procesarMediaInstagram(admin, negocio, usuario, m)) r.borradoresNuevos++;
        await marcar(admin, negocio.id, "instagram", { identificador: usuario, ultima_sync: inicioRun, ultimo_error: null });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (err instanceof CuentaNoAccesible) {
          // Cuenta personal o inexistente: no insistir hasta que el admin lo mire.
          await marcar(admin, negocio.id, "instagram", { identificador: usuario, desactivado: true, ultimo_error: msg.slice(0, 300) });
          r.desactivados.push(negocio.slug);
        } else {
          await marcar(admin, negocio.id, "instagram", { identificador: usuario, ultimo_error: msg.slice(0, 300) });
          r.errores.push(`${negocio.slug}: ${msg}`);
          // Un error de token/cuota afecta a todos: no seguir quemando llamadas.
          if (/token|OAuth|rate limit|\(#4\)|\(#17\)/i.test(msg)) break;
        }
      }
    }
    return r;
  }

  // Vía Apify: todo el lote en una ejecución, como Facebook. "desde" =
  // la fecha más antigua del lote; el filtro fino por negocio va después.
  const desdeLote = new Date(validos.map((v) => v.desde).sort()[0]);
  const inicioRun = new Date().toISOString();
  let lectura: Awaited<ReturnType<typeof mediaPublicoInstagramApify>>;
  try {
    lectura = await mediaPublicoInstagramApify(validos.map((v) => v.usuario), desdeLote);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    r.errores.push(msg);
    for (const v of validos) await marcar(admin, v.negocio.id, "instagram", { identificador: v.usuario, ultimo_error: msg.slice(0, 300) });
    return r;
  }

  for (const { negocio, desde, usuario } of validos) {
    const motivo = lectura.noAccesibles.get(usuario.toLowerCase());
    if (motivo) {
      await marcar(admin, negocio.id, "instagram", { identificador: usuario, desactivado: true, ultimo_error: motivo.slice(0, 300) });
      r.desactivados.push(negocio.slug);
      continue;
    }
    const media = (lectura.porUsuario.get(usuario.toLowerCase()) ?? []).filter((m) => new Date(m.timestamp) > new Date(desde));
    r.publicaciones += media.length;
    try {
      for (const m of media) if (await procesarMediaInstagram(admin, negocio, usuario, m)) r.borradoresNuevos++;
      await marcar(admin, negocio.id, "instagram", { identificador: usuario, ultima_sync: inicioRun, ultimo_error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await marcar(admin, negocio.id, "instagram", { identificador: usuario, ultimo_error: msg.slice(0, 300) });
      r.errores.push(`${negocio.slug}: ${msg}`);
    }
  }
  return r;
}

// ---------------------------------------------------------------
// Facebook (Apify)
// ---------------------------------------------------------------

export async function sincronizarFacebookPublico(admin: SupabaseClient, lote = 40): Promise<ResumenPublico> {
  const r: ResumenPublico = { plataforma: "facebook", negocios: 0, publicaciones: 0, borradoresNuevos: 0, desactivados: [], errores: [] };
  if (!apifyConfigurado()) {
    r.errores.push("Apify sin configurar (APIFY_TOKEN).");
    return r;
  }

  const pendientes = await negociosConRed(admin, "facebook", lote, urlPaginaFacebook);
  const validos: { negocio: NegocioRed; desde: string; url: string }[] = [];
  for (const { negocio, desde } of pendientes) {
    const url = urlPaginaFacebook(negocio.facebook);
    if (!url) {
      await marcar(admin, negocio.id, "facebook", { identificador: null, desactivado: true, ultimo_error: `Página ilegible: ${negocio.facebook}` });
      r.desactivados.push(negocio.slug);
      continue;
    }
    validos.push({ negocio, desde, url });
  }
  if (validos.length === 0) return r;
  r.negocios = validos.length;

  // Una sola ejecución del actor para todo el lote. "desde" = la
  // fecha más antigua del lote; el filtro fino por negocio va después.
  const desdeLote = new Date(validos.map((v) => v.desde).sort()[0]);
  const inicioRun = new Date().toISOString();
  let porPagina: Awaited<ReturnType<typeof postsPublicosFacebook>>;
  try {
    porPagina = await postsPublicosFacebook(
      validos.map((v) => v.url),
      desdeLote
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    r.errores.push(msg);
    for (const v of validos) await marcar(admin, v.negocio.id, "facebook", { identificador: v.url, ultimo_error: msg.slice(0, 300) });
    return r;
  }

  for (const v of validos) {
    const posts = (porPagina.get(v.url) ?? []).filter((p) => !p.fecha || new Date(p.fecha) > new Date(v.desde));
    r.publicaciones += posts.length;
    for (const p of posts) {
      if (!p.imagenUrl && !/\d/.test(p.texto ?? "")) continue;
      const imagen = p.imagenUrl ? await descargarImagen(p.imagenUrl) : null;
      const salida = await procesarEntradaBuzon(admin, {
        canal: "facebook",
        externoId: p.id,
        remitente: v.url,
        remitenteNombre: v.negocio.nombre,
        negocio: v.negocio as NegocioBuzon,
        texto: p.texto,
        imagen,
        fuenteUrl: p.url,
      });
      if (salida.estado === "borrador") r.borradoresNuevos++;
    }
    await marcar(admin, v.negocio.id, "facebook", { identificador: v.url, ultima_sync: inicioRun, ultimo_error: null });
  }
  return r;
}

// ---------------------------------------------------------------
// Cuentas fuente (fuentes_redes): agregadores, grupos, peñas. No son
// negocios; el evento sale sin negocio salvo que el cartel nombre uno
// de la guía (ver negocioPorNombre en buzon.ts).
// ---------------------------------------------------------------

interface FuenteRed {
  id: string;
  plataforma: "instagram" | "facebook" | "facebook_grupo";
  identificador: string;
  nombre: string;
  ultima_sync: string | null;
}

export async function sincronizarFuentesPublicas(admin: SupabaseClient): Promise<ResumenPublico> {
  const r: ResumenPublico = { plataforma: "fuentes", negocios: 0, publicaciones: 0, borradoresNuevos: 0, desactivados: [], errores: [] };
  if (!apifyConfigurado()) {
    r.errores.push("Apify sin configurar (APIFY_TOKEN).");
    return r;
  }
  const { data } = await admin
    .from("fuentes_redes")
    .select("id, plataforma, identificador, nombre, ultima_sync")
    .eq("activa", true)
    .returns<FuenteRed[]>();
  const fuentes = data ?? [];
  if (!fuentes.length) return r;
  r.negocios = fuentes.length;

  // Un agregador anuncia con semanas de antelación: la primera lectura
  // mira más atrás que la de un bar (que publica el cartel de su finde).
  const inicial = new Date(Date.now() - 30 * 86400000).toISOString();
  const desdeDe = (f: FuenteRed) => new Date(f.ultima_sync ?? inicial);
  const inicioRun = new Date().toISOString();
  const marcarFuente = (id: string, campos: { ultima_sync?: string; ultimo_error: string | null }) =>
    admin.from("fuentes_redes").update(campos).eq("id", id);

  const procesar = async (f: FuenteRed, canal: "instagram" | "facebook", posts: { id: string; texto: string | null; imagenUrl: string | null; url: string | null }[]) => {
    r.publicaciones += posts.length;
    try {
      for (const p of posts) {
        const imagen = p.imagenUrl ? await descargarImagen(p.imagenUrl) : null;
        const salida = await procesarEntradaBuzon(admin, {
          canal,
          externoId: p.id,
          remitente: f.identificador,
          remitenteNombre: f.nombre,
          negocio: null,
          fuenteId: f.id,
          texto: p.texto,
          imagen,
          fuenteUrl: p.url,
          fuenteNombre: f.nombre,
        });
        if (salida.estado === "borrador") r.borradoresNuevos++;
      }
      await marcarFuente(f.id, { ultima_sync: inicioRun, ultimo_error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await marcarFuente(f.id, { ultimo_error: msg.slice(0, 300) });
      r.errores.push(`${f.nombre}: ${msg}`);
    }
  };

  // Instagram: una ejecución para todas las cuentas fuente.
  const ig = fuentes.filter((f) => f.plataforma === "instagram");
  if (ig.length) {
    try {
      const usuarios = ig.map((f) => usuarioInstagram(f.identificador) ?? f.identificador);
      const lectura = await mediaPublicoInstagramApify(usuarios, new Date(Math.min(...ig.map((f) => desdeDe(f).getTime()))));
      for (const f of ig) {
        const usuario = (usuarioInstagram(f.identificador) ?? f.identificador).toLowerCase();
        const media = (lectura.porUsuario.get(usuario) ?? []).filter((m) => new Date(m.timestamp) > desdeDe(f));
        await procesar(
          f,
          "instagram",
          media.map((m) => ({ id: m.id, texto: m.caption ?? null, imagenUrl: (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) ?? null, url: m.permalink ?? null }))
        );
      }
    } catch (err) {
      r.errores.push(`Instagram fuentes: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Facebook: páginas y grupos, cada uno con su actor.
  for (const [plataforma, leer] of [
    ["facebook", postsPublicosFacebook],
    ["facebook_grupo", postsPublicosGruposFacebook],
  ] as const) {
    const lista = fuentes.filter((f) => f.plataforma === plataforma);
    if (!lista.length) continue;
    try {
      const urls = lista.map((f) => (plataforma === "facebook" ? urlPaginaFacebook(f.identificador) ?? f.identificador : f.identificador));
      const porUrl = await leer(urls, new Date(Math.min(...lista.map((f) => desdeDe(f).getTime()))));
      for (const [i, f] of lista.entries()) {
        const posts = (porUrl.get(urls[i]) ?? []).filter((p) => !p.fecha || new Date(p.fecha) > desdeDe(f));
        await procesar(f, "facebook", posts);
      }
    } catch (err) {
      r.errores.push(`${plataforma} fuentes: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return r;
}
