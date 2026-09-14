"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dentroDeLimite } from "@/lib/limites";
import { isoDesdeHoraJaen, isoDiaCompletoJaen, finEvento } from "@/lib/eventos";

// Código de Postgres para violación de índice único. En `eventos` hay
// dos: uq_eventos_url_canonica y uq_eventos_huella (municipio + día +
// título normalizado), que es la que puede saltar aquí.
const UNIQUE_VIOLATION = "23505";

// El panel es por negocio (/panel/[slug]) desde la migración 0011; sin
// slug se cae a la lista de negocios.
function volverAlPanel(
  mensaje: string,
  tipo: "error" | "ok" = "error",
  slugNegocio = ""
): never {
  const base = slugNegocio ? `/panel/${slugNegocio}` : "/panel";
  redirect(`${base}?${tipo}=${encodeURIComponent(mensaje)}#eventos`);
}

type ResultadoInsert = { ok: true } | { ok: false; mensaje: string };

/**
 * Valida el formulario de evento e inserta como origen 'negocio'. Lo
 * comparten la acción del dueño y la del admin: la diferencia entre
 * ambas es solo quién puede llamarla y a dónde vuelve después.
 */
async function insertarEventoNegocio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  formData: FormData
): Promise<ResultadoInsert> {
  const negocioId = String(formData.get("negocio_id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const esTodoElDia = formData.get("es_todo_el_dia") === "on";
  const inicioBruto = String(formData.get("fecha_inicio") ?? "");
  const finBruto = String(formData.get("fecha_fin") ?? "").trim();

  if (!negocioId) return { ok: false, mensaje: "No hemos encontrado el negocio." };
  if (titulo.length < 3) return { ok: false, mensaje: "El título es demasiado corto." };
  if (titulo.length > 120) return { ok: false, mensaje: "El título no puede pasar de 120 caracteres." };

  // Un evento de todo el día se pide con <input type="date"> y empieza a
  // medianoche; el resto viene de un datetime-local.
  const fechaInicio = esTodoElDia
    ? isoDiaCompletoJaen(inicioBruto)
    : isoDesdeHoraJaen(inicioBruto);
  if (!fechaInicio) return { ok: false, mensaje: "Falta la fecha del evento o no es válida." };

  let fechaFin: string | null = null;
  if (finBruto) {
    fechaFin = esTodoElDia ? isoDiaCompletoJaen(finBruto) : isoDesdeHoraJaen(finBruto);
    if (!fechaFin) return { ok: false, mensaje: "La fecha de fin no es válida." };
    // El CHECK eventos_fechas_coherentes lo rechazaría igual, pero con un
    // error de base de datos en vez de una frase entendible.
    if (fechaFin < fechaInicio) return { ok: false, mensaje: "El evento no puede acabar antes de empezar." };
  }

  const esGratis = formData.get("es_gratis") === "on";
  const precioTexto = String(formData.get("precio_texto") ?? "").trim();
  const categoriaId = String(formData.get("categoria_id") ?? "").trim();
  const lugarNombre = String(formData.get("lugar_nombre") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();

  // Plan Destacado (migración 0016): sus eventos nacen promocionados.
  const { data: negocio } = await supabase.from("negocios").select("plan").eq("id", negocioId).maybeSingle<{ plan: string }>();
  const promocionadoHasta = negocio?.plan === "destacado" ? finEvento(fechaInicio, fechaFin) : null;

  const { error } = await supabase.from("eventos").insert({
    titulo,
    descripcion: descripcion || null,
    negocio_id: negocioId,
    categoria_id: categoriaId || null,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    es_todo_el_dia: esTodoElDia,
    es_gratis: esGratis,
    precio_texto: esGratis ? null : precioTexto || null,
    lugar_nombre: lugarNombre || null,
    direccion: direccion || null,
    origen: "negocio",
    estado: "publicado",
    creado_por: userId,
    promocionado_hasta: promocionadoHasta,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, mensaje: "Ya hay un evento con ese título ese mismo día." };
    }
    // Un 42501 (RLS) aquí significa que el negocio no es del usuario.
    return { ok: false, mensaje: "No hemos podido publicar el evento. Revisa los datos." };
  }

  revalidatePath("/panel");
  revalidatePath("/");
  revalidatePath("/eventos");
  return { ok: true };
}

/**
 * Publica un evento del negocio del usuario autenticado.
 *
 * La RLS ("Dueño crea eventos de su negocio", migración 0006) es la que
 * manda: exige negocio propio, origen 'negocio' y duplicado_de nulo. Aquí
 * solo se valida lo que hace falta para dar un mensaje decente.
 */
export async function crearEventoNegocio(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slugNegocio = String(formData.get("slug_negocio") ?? "");
  // Anti-abuso: un dueño real no publica más de un puñado de eventos
  // seguidos. 12/hora deja margen de sobra y frena un bucle automatizado.
  if (!(await dentroDeLimite(supabase, `user:${user.id}`, "evento", 12, "1 hour"))) {
    volverAlPanel("Estás publicando eventos muy rápido. Espera un rato e inténtalo de nuevo.", "error", slugNegocio);
  }
  const resultado = await insertarEventoNegocio(supabase, user.id, formData);
  if (!resultado.ok) volverAlPanel(resultado.mensaje, "error", slugNegocio);

  if (slugNegocio) {
    revalidatePath(`/panel/${slugNegocio}`);
    revalidatePath(`/negocio/${slugNegocio}`);
  }

  volverAlPanel("Evento publicado.", "ok", slugNegocio);
}

const RUTA_ADMIN_DESTACADOS = "/admin/destacados-sin-eventos";

/**
 * Publica un evento en nombre de un negocio desde /admin. La RLS "Admin
 * gestiona eventos" (0001) ya deja el insert, pero se comprueba el rol
 * aquí también para no depender solo de la policy y para devolver un
 * mensaje claro. El evento queda igual que si lo hubiera creado el
 * dueño (origen 'negocio', negocio_id del bar); creado_por es el admin.
 */
export async function crearEventoComoAdmin(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?volver=${encodeURIComponent(RUTA_ADMIN_DESTACADOS)}`);

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "admin") redirect("/");

  const slugNegocio = String(formData.get("slug_negocio") ?? "");
  const volver = (tipo: "ok" | "error", mensaje: string): never =>
    redirect(`${RUTA_ADMIN_DESTACADOS}?${tipo}=${encodeURIComponent(mensaje)}`);

  const resultado = await insertarEventoNegocio(supabase, user.id, formData);
  if (!resultado.ok) volver("error", resultado.mensaje);

  revalidatePath(RUTA_ADMIN_DESTACADOS);
  if (slugNegocio) {
    revalidatePath(`/panel/${slugNegocio}`);
    revalidatePath(`/negocio/${slugNegocio}`);
  }

  volver("ok", "Evento publicado.");
}

/** Borra un evento propio. La policy de DELETE solo deja los del dueño. */
export async function borrarEventoNegocio(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const eventoId = String(formData.get("evento_id") ?? "");
  const slugNegocio = String(formData.get("slug_negocio") ?? "");
  if (!eventoId) volverAlPanel("Evento no encontrado.", "error", slugNegocio);

  // Además de la RLS: un evento de agenda oficial asociado a un negocio
  // no debe poder borrarse desde aquí. Los borradores de WhatsApp sí
  // (descartar = borrar).
  const { error } = await supabase
    .from("eventos")
    .delete()
    .eq("id", eventoId)
    .in("origen", ["negocio", "whatsapp", "facebook", "instagram"]);

  if (error) volverAlPanel("No hemos podido borrar el evento.", "error", slugNegocio);

  revalidatePath("/panel");
  revalidatePath("/");
  revalidatePath("/eventos");
  if (slugNegocio) {
    revalidatePath(`/panel/${slugNegocio}`);
    revalidatePath(`/negocio/${slugNegocio}`);
  }

  volverAlPanel("Evento borrado.", "ok", slugNegocio);
}

/**
 * Publica un borrador que llegó por WhatsApp (migración 0013), con los
 * retoques que el dueño haya hecho en el panel. La RLS de UPDATE exige
 * negocio propio y origen negocio/whatsapp; aquí se acota además a
 * estado = 'borrador' para no re-publicar por accidente.
 */
export async function publicarBorradorEvento(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const eventoId = String(formData.get("evento_id") ?? "");
  const slugNegocio = String(formData.get("slug_negocio") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const esTodoElDia = formData.get("es_todo_el_dia") === "on";
  const inicioBruto = String(formData.get("fecha_inicio") ?? "");
  const precioTexto = String(formData.get("precio_texto") ?? "").trim();
  const esGratis = formData.get("es_gratis") === "on";
  const descripcion = String(formData.get("descripcion") ?? "").trim();

  if (!eventoId) volverAlPanel("Borrador no encontrado.", "error", slugNegocio);
  if (titulo.length < 3) volverAlPanel("El título es demasiado corto.", "error", slugNegocio);
  if (titulo.length > 120) volverAlPanel("El título no puede pasar de 120 caracteres.", "error", slugNegocio);

  // El formulario del borrador usa siempre un datetime-local; si es de
  // todo el día se descarta la hora.
  const fechaInicio = esTodoElDia
    ? isoDiaCompletoJaen(inicioBruto.slice(0, 10))
    : isoDesdeHoraJaen(inicioBruto);
  if (!fechaInicio) volverAlPanel("Falta la fecha del evento o no es válida.", "error", slugNegocio);

  const { error, count } = await supabase
    .from("eventos")
    .update(
      {
        titulo,
        descripcion: descripcion || null,
        fecha_inicio: fechaInicio,
        es_todo_el_dia: esTodoElDia,
        es_gratis: esGratis,
        precio_texto: esGratis ? null : precioTexto || null,
        estado: "publicado",
        creado_por: user.id,
      },
      { count: "exact" }
    )
    .eq("id", eventoId)
    .eq("estado", "borrador");

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      volverAlPanel("Ya hay un evento con ese título ese mismo día.", "error", slugNegocio);
    }
    volverAlPanel("No hemos podido publicar el borrador.", "error", slugNegocio);
  }
  if (!count) volverAlPanel("Ese borrador ya no existe.", "error", slugNegocio);

  revalidatePath("/panel");
  revalidatePath("/");
  revalidatePath("/eventos");
  if (slugNegocio) {
    revalidatePath(`/panel/${slugNegocio}`);
    revalidatePath(`/negocio/${slugNegocio}`);
  }

  volverAlPanel("Evento publicado.", "ok", slugNegocio);
}

/**
 * Bandeja del admin (/admin/borradores): publica o descarta lo que
 * entró por redes. La policy "Admin gestiona eventos" (0001) es la que
 * autoriza; aquí solo se comprueba el rol para dar un mensaje decente.
 */
export async function resolverBorradorAdmin(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?volver=%2Fadmin%2Fborradores");

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  const volver = (msg: string, tipo: "ok" | "error" = "error"): never =>
    redirect(`/admin/borradores?${tipo}=${encodeURIComponent(msg)}`);
  if (perfil?.rol !== "admin") return volver("Solo para administradores.");

  const eventoId = String(formData.get("evento_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const slugNegocio = String(formData.get("slug_negocio") ?? "");
  if (!eventoId) return volver("Borrador no encontrado.");

  if (decision === "descartar") {
    const { error } = await supabase.from("eventos").delete().eq("id", eventoId).eq("estado", "borrador");
    if (error) return volver("No hemos podido descartar el borrador.");
    return volver("Borrador descartado.", "ok");
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  const esTodoElDia = formData.get("es_todo_el_dia") === "on";
  const inicioBruto = String(formData.get("fecha_inicio") ?? "");
  const precioTexto = String(formData.get("precio_texto") ?? "").trim();
  const esGratis = formData.get("es_gratis") === "on";
  const descripcion = String(formData.get("descripcion") ?? "").trim();

  if (titulo.length < 3) return volver("El título es demasiado corto.");
  const fechaInicio = esTodoElDia ? isoDiaCompletoJaen(inicioBruto.slice(0, 10)) : isoDesdeHoraJaen(inicioBruto);
  if (!fechaInicio) return volver("Falta la fecha del evento o no es válida.");

  const { error, count } = await supabase
    .from("eventos")
    .update(
      {
        titulo: titulo.slice(0, 120),
        descripcion: descripcion || null,
        fecha_inicio: fechaInicio,
        es_todo_el_dia: esTodoElDia,
        es_gratis: esGratis,
        precio_texto: esGratis ? null : precioTexto || null,
        estado: "publicado",
        creado_por: user.id,
      },
      { count: "exact" }
    )
    .eq("id", eventoId)
    .eq("estado", "borrador");

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return volver("Ya hay un evento con ese título ese mismo día.");
    return volver("No hemos podido publicar el borrador.");
  }
  if (!count) return volver("Ese borrador ya no existe.");

  revalidatePath("/");
  revalidatePath("/eventos");
  if (slugNegocio) {
    revalidatePath(`/panel/${slugNegocio}`);
    revalidatePath(`/negocio/${slugNegocio}`);
  }
  return volver("Evento publicado.", "ok");
}

/**
 * Quita un evento que entró solo desde redes y no debería estar. Con
 * la publicación automática, esta es la red de seguridad: un error
 * visible un día es aceptable; que no se pueda quitar en un clic, no.
 */
export async function quitarEventoRedAdmin(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?volver=%2Fadmin%2Fborradores");

  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  const volver = (msg: string, tipo: "ok" | "error" = "error"): never =>
    redirect(`/admin/borradores?${tipo}=${encodeURIComponent(msg)}`);
  if (perfil?.rol !== "admin") return volver("Solo para administradores.");

  const eventoId = String(formData.get("evento_id") ?? "");
  const slugNegocio = String(formData.get("slug_negocio") ?? "");
  if (!eventoId) return volver("Evento no encontrado.");

  const { error, count } = await supabase
    .from("eventos")
    .delete({ count: "exact" })
    .eq("id", eventoId)
    .in("origen", ["whatsapp", "facebook", "instagram"]);
  if (error) return volver("No hemos podido quitar el evento.");
  if (!count) return volver("Ese evento ya no existe.");

  revalidatePath("/");
  revalidatePath("/eventos");
  if (slugNegocio) revalidatePath(`/negocio/${slugNegocio}`);
  return volver("Evento quitado.", "ok");
}
