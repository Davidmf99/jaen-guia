import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { firmaValida, extraerMensajes, descargarMedia, enviarTexto, type MensajeWhatsApp } from "@/lib/whatsapp";
import { procesarEntradaBuzon, type NegocioBuzon } from "@/lib/buzon";
import { fechaEventoAbsoluta } from "@/lib/eventos";

// Webhook de la WhatsApp Cloud API. Un dueño reenvía el cartel de su
// evento al número de Jaén Guía; aquí se resuelve de quién es el
// teléfono y se pasa a lib/buzon (Claude → evento en borrador).
//
// Node: node:crypto para la firma y service_role para escribir en el
// buzón y en eventos saltando la RLS (el remitente no es un usuario
// logueado). Descargar la imagen + Claude puede pasar de 10 s.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function urlSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Verificación del webhook al registrarlo en el panel de Meta. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modo = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const reto = searchParams.get("hub.challenge");
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN;

  if (modo === "subscribe" && esperado && token === esperado && reto) {
    return new Response(reto, { status: 200 });
  }
  return NextResponse.json({ error: "Verificación inválida." }, { status: 403 });
}

export async function POST(request: Request) {
  // La firma se calcula sobre el cuerpo crudo: hay que leerlo como texto
  // antes de parsearlo.
  const crudo = await request.text();
  if (!firmaValida(crudo, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  // Meta reintenta si no recibe 200 en pocos segundos, así que cada
  // mensaje se procesa entero pero sin dejar que un fallo tumbe el resto.
  const resultados: Record<string, string> = {};
  for (const { mensaje, nombre } of extraerMensajes(cuerpo)) {
    try {
      resultados[mensaje.id] = await procesarMensaje(admin, mensaje, nombre);
    } catch (err) {
      console.error("[whatsapp] error procesando", mensaje.id, err);
      resultados[mensaje.id] = "error";
    }
  }

  return NextResponse.json({ ok: true, resultados });
}

async function procesarMensaje(admin: SupabaseClient, mensaje: MensajeWhatsApp, nombre: string | null): Promise<string> {
  const texto = mensaje.text?.body ?? mensaje.image?.caption ?? null;
  const tieneImagen = mensaje.type === "image" && Boolean(mensaje.image?.id);

  // Teléfono → negocio. Sin negocio no se gasta una llamada a Claude:
  // se deja constancia y el admin lo asigna desde la bandeja.
  const { data: negocioId } = await admin.rpc("negocio_por_telefono", { p_telefono: mensaje.from });
  if (!negocioId) {
    await admin.from("buzon_mensajes").upsert(
      {
        canal: "whatsapp",
        mensaje_externo_id: mensaje.id,
        remitente: mensaje.from,
        remitente_nombre: nombre,
        texto,
        imagen_mime: mensaje.image?.mime_type ?? null,
        estado: "sin_negocio",
        procesado_en: new Date().toISOString(),
      },
      { onConflict: "canal,mensaje_externo_id", ignoreDuplicates: true }
    );
    await enviarTexto(
      mensaje.from,
      "¡Hola! Somos Jaén Guía. No tenemos este número asociado a ningún negocio. Si tienes un local en Jaén, reclama tu ficha en " +
        `${urlSitio()}/para-negocios y lo vinculamos.`
    );
    return "sin_negocio";
  }

  const { data: negocio } = await admin
    .from("negocios")
    .select("id, slug, nombre, categoria_id, municipio_id")
    .eq("id", negocioId)
    .single<NegocioBuzon>();
  if (!negocio) return "sin_negocio";

  let imagen: { bytes: Buffer; mime: string } | null = null;
  if (tieneImagen) {
    try {
      imagen = await descargarMedia(mensaje.image!.id);
    } catch (err) {
      console.error("[whatsapp] descarga media", err);
    }
  }

  const salida = await procesarEntradaBuzon(admin, {
    canal: "whatsapp",
    externoId: mensaje.id,
    remitente: mensaje.from,
    remitenteNombre: nombre,
    negocio,
    texto,
    imagen,
  });

  switch (salida.estado) {
    case "borrador": {
      revalidatePath(`/panel/${negocio.slug}`);
      const cuando = fechaEventoAbsoluta(salida.fechaInicio!, salida.extraido!.es_todo_el_dia);
      await enviarTexto(
        mensaje.from,
        `¡Recibido! Hemos leído tu cartel:\n\n*${salida.extraido!.titulo}*\n${cuando}\n\n` +
          `Revísalo y publícalo con un toque: ${urlSitio()}/panel/${negocio.slug}#borradores`
      );
      break;
    }
    case "no_es_evento":
      await enviarTexto(
        mensaje.from,
        "¡Recibido! No hemos visto una fecha en el mensaje, así que no lo hemos añadido a la agenda. " +
          "Si es un evento, mándanos el cartel con el día y la hora."
      );
      break;
    case "duplicado":
      await enviarTexto(mensaje.from, `«${salida.extraido?.titulo}» ya estaba en la agenda ese día. No hemos creado nada nuevo.`);
      break;
  }
  return salida.estado;
}
