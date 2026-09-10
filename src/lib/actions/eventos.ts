"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isoDesdeHoraJaen, isoDiaCompletoJaen } from "@/lib/eventos";

// Código de Postgres para violación de índice único. En `eventos` hay
// dos: uq_eventos_url_canonica y uq_eventos_huella (municipio + día +
// título normalizado), que es la que puede saltar aquí.
const UNIQUE_VIOLATION = "23505";

function volverAlPanel(mensaje: string, tipo: "error" | "ok" = "error"): never {
  redirect(`/panel?${tipo}=${encodeURIComponent(mensaje)}#eventos`);
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

  const negocioId = String(formData.get("negocio_id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const esTodoElDia = formData.get("es_todo_el_dia") === "on";
  const inicioBruto = String(formData.get("fecha_inicio") ?? "");
  const finBruto = String(formData.get("fecha_fin") ?? "").trim();

  if (!negocioId) volverAlPanel("No hemos encontrado tu negocio.");
  if (titulo.length < 3) volverAlPanel("El título es demasiado corto.");
  if (titulo.length > 120) volverAlPanel("El título no puede pasar de 120 caracteres.");

  // Un evento de todo el día se pide con <input type="date"> y empieza a
  // medianoche; el resto viene de un datetime-local.
  const fechaInicio = esTodoElDia
    ? isoDiaCompletoJaen(inicioBruto)
    : isoDesdeHoraJaen(inicioBruto);
  if (!fechaInicio) volverAlPanel("Falta la fecha del evento o no es válida.");

  let fechaFin: string | null = null;
  if (finBruto) {
    fechaFin = esTodoElDia ? isoDiaCompletoJaen(finBruto) : isoDesdeHoraJaen(finBruto);
    if (!fechaFin) volverAlPanel("La fecha de fin no es válida.");
    // El CHECK eventos_fechas_coherentes lo rechazaría igual, pero con un
    // error de base de datos en vez de una frase entendible.
    if (fechaFin < fechaInicio) volverAlPanel("El evento no puede acabar antes de empezar.");
  }

  const esGratis = formData.get("es_gratis") === "on";
  const precioTexto = String(formData.get("precio_texto") ?? "").trim();
  const categoriaId = String(formData.get("categoria_id") ?? "").trim();
  const lugarNombre = String(formData.get("lugar_nombre") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();

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
    creado_por: user.id,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      volverAlPanel("Ya hay un evento con ese título ese mismo día.");
    }
    // Un 42501 (RLS) aquí significa que el negocio no es del usuario.
    volverAlPanel("No hemos podido publicar el evento. Revisa los datos.");
  }

  revalidatePath("/panel");
  revalidatePath("/");
  revalidatePath("/eventos");

  const slugNegocio = String(formData.get("slug_negocio") ?? "");
  if (slugNegocio) revalidatePath(`/negocio/${slugNegocio}`);

  volverAlPanel("Evento publicado.", "ok");
}

/** Borra un evento propio. La policy de DELETE solo deja los del dueño. */
export async function borrarEventoNegocio(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const eventoId = String(formData.get("evento_id") ?? "");
  if (!eventoId) volverAlPanel("Evento no encontrado.");

  // origen = 'negocio' además de la RLS: un evento de agenda oficial
  // asociado a un negocio no debe poder borrarse desde aquí.
  const { error } = await supabase
    .from("eventos")
    .delete()
    .eq("id", eventoId)
    .eq("origen", "negocio");

  if (error) volverAlPanel("No hemos podido borrar el evento.");

  revalidatePath("/panel");
  revalidatePath("/");
  revalidatePath("/eventos");

  volverAlPanel("Evento borrado.", "ok");
}
