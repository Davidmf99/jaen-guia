// Un correo por situación. Cada función devuelve asunto + HTML + texto
// plano; el envío lo hace enviarCorreo (index.ts). Los que manda
// Supabase Auth (confirmar cuenta, recuperar contraseña, cambiar email)
// no están aquí: viven en supabase/templates/ y se pegan en su panel.

import { urlSitio } from "@/lib/sitio";
import { correo, n, escapar, fechaLarga, fechaCorta, EMAIL_CONTACTO } from "./plantilla";
import { PRECIO_PLAN_DESTACADO } from "@/lib/stripe";

interface Negocio {
  nombre: string;
  slug: string;
}

/** Lo que se cuenta de un cobro. La factura la genera Stripe (con IVA). */
export interface Pago {
  /** Ya formateado: "14,99 €". */
  importe: string;
  numeroFactura: string | null;
  urlFactura: string | null;
}

const MOTIVO_NEGOCIO = (negocio: Negocio) => `Recibes este correo porque gestionas ${negocio.nombre} en Jaén Guía.`;

function panel(negocio: Negocio, ancla = "") {
  return `${urlSitio()}/panel/${negocio.slug}${ancla}`;
}

function botonFactura(pago: Pago) {
  return pago.urlFactura ? { texto: "Ver factura", url: pago.urlFactura } : undefined;
}

function detallesPago(pago: Pago, extra: [string, string][] = []): [string, string][] {
  return [
    ["Importe", `${pago.importe} (IVA incluido)`],
    ...(pago.numeroFactura ? ([["Factura", pago.numeroFactura]] as [string, string][]) : []),
    ...extra,
  ];
}

// ── Cuenta ────────────────────────────────────────────────────────────

export function correoBienvenida(persona: { nombre: string | null }) {
  const saludo = persona.nombre ? `Hola, ${n(persona.nombre)}.` : "Hola.";
  return correo({
    asunto: "Bienvenido a Jaén Guía",
    resumen: "Tu cuenta ya está activa. Esto es lo que puedes hacer.",
    titulo: "Ya estás dentro",
    parrafos: [
      `${saludo} Tu cuenta está confirmada. Jaén Guía es la guía de bares, restaurantes, planes y eventos de Jaén, hecha desde aquí.`,
      "Guarda tus sitios favoritos, deja reseñas y entérate de lo que pasa cada semana en la agenda.",
      `¿Tienes un bar o un negocio en Jaén? Búscalo en la guía y pulsa <em>"¿Es tu negocio?"</em> para gestionar su ficha, o escríbenos si no aparece.`,
    ],
    boton: { texto: "Ver qué hay esta semana", url: `${urlSitio()}/eventos` },
    notas: [`Para negocios: <a href="${urlSitio()}/para-negocios" style="color:inherit">qué ofrecemos y cuánto cuesta</a>.`],
    motivo: "Recibes este correo porque acabas de crear una cuenta en Jaén Guía.",
  });
}

// ── Gestión de negocios ───────────────────────────────────────────────

export function correoSolicitudRecibida(negocio: Negocio) {
  return correo({
    asunto: `Hemos recibido tu solicitud para ${negocio.nombre}`,
    resumen: "La revisamos a mano en menos de 48 horas.",
    titulo: "Solicitud recibida",
    parrafos: [
      `Has pedido gestionar la ficha de ${n(negocio.nombre)} en Jaén Guía. La revisamos a mano —comprobamos que el negocio es tuyo— y te avisamos por este correo en cuanto esté lista, normalmente en menos de 48 horas.`,
      "Si nos cuesta confirmarlo te escribiremos para pedirte algún dato más.",
    ],
    boton: { texto: "Ver la ficha", url: `${urlSitio()}/negocio/${negocio.slug}` },
    motivo: `Recibes este correo porque has pedido gestionar ${negocio.nombre} en Jaén Guía.`,
  });
}

export function correoAdminNuevaSolicitud(datos: {
  negocio: Negocio;
  solicitante: { nombre: string | null; email: string };
  mensaje: string | null;
  telefono: string | null;
}) {
  const { negocio, solicitante } = datos;
  return correo({
    asunto: `Nueva solicitud: ${negocio.nombre}`,
    resumen: `${solicitante.nombre ?? solicitante.email} pide gestionar ${negocio.nombre}.`,
    titulo: "Alguien pide gestionar un negocio",
    parrafos: [`${n(solicitante.nombre ?? solicitante.email)} quiere gestionar la ficha de ${n(negocio.nombre)}.`],
    detalles: [
      ["Negocio", negocio.nombre],
      ["Solicitante", solicitante.nombre ?? "—"],
      ["Email", solicitante.email],
      ["Teléfono", datos.telefono ?? "—"],
      ["Mensaje", datos.mensaje ?? "—"],
    ],
    boton: { texto: "Revisar en el admin", url: `${urlSitio()}/admin/solicitudes` },
    notas: [`Ficha pública: <a href="${urlSitio()}/negocio/${negocio.slug}" style="color:inherit">${escapar(`${urlSitio()}/negocio/${negocio.slug}`)}</a>`],
    motivo: "Aviso interno para el administrador de Jaén Guía.",
  });
}

export function correoSolicitudAprobada(negocio: Negocio) {
  return correo({
    asunto: `Ya puedes gestionar ${negocio.nombre} en Jaén Guía`,
    resumen: "Horarios, fotos, especialidades y eventos: la ficha es tuya.",
    titulo: `${negocio.nombre} es tuyo`,
    parrafos: [
      `Hemos comprobado la solicitud y ya puedes editar la ficha de ${n(negocio.nombre)}: horarios, foto de portada, especialidades, servicios y eventos.`,
      "Cuanto más completa esté la ficha, más arriba sale y más gente la guarda.",
      "Y si quieres que tus eventos y tu negocio salgan en portada, en el panel tienes el plan Destacado y la promoción de eventos.",
    ],
    boton: { texto: "Editar mi ficha", url: panel(negocio) },
    motivo: MOTIVO_NEGOCIO(negocio),
  });
}

export function correoSolicitudRechazada(negocio: { nombre: string }) {
  return correo({
    asunto: `Sobre tu solicitud para ${negocio.nombre}`,
    resumen: "No hemos podido confirmar que gestionas este negocio.",
    titulo: "No hemos podido confirmar la solicitud",
    parrafos: [
      `No hemos podido verificar que gestionas ${n(negocio.nombre)}, así que de momento no le hemos dado acceso a esta cuenta.`,
      `Si crees que es un error, responde a este correo o escríbenos a ${EMAIL_CONTACTO} y lo revisamos contigo.`,
    ],
    boton: { texto: "Escribir a Jaén Guía", url: `${urlSitio()}/contacto` },
    motivo: `Recibes este correo porque pediste gestionar ${negocio.nombre} en Jaén Guía.`,
  });
}

export function correoBorradoresNuevos(negocio: Negocio, cuantos: number) {
  const cuenta = cuantos === 1 ? "1 evento nuevo" : `${cuantos} eventos nuevos`;
  return correo({
    asunto: `${cuenta} para revisar en ${negocio.nombre}`,
    resumen: "Lo hemos leído de tus redes. Publícalo con un toque.",
    titulo: `Hemos visto ${cuenta} en tu Facebook o Instagram`,
    parrafos: [
      `Lo hemos leído y lo tienes preparado en el panel de ${n(negocio.nombre)}. Revisa el título y la hora y publícalo con un toque.`,
      "Nada sale en la agenda de Jaén Guía sin que lo confirmes tú.",
    ],
    boton: { texto: "Revisar y publicar", url: panel(negocio, "#borradores") },
    motivo: MOTIVO_NEGOCIO(negocio),
  });
}

// ── Pagos ─────────────────────────────────────────────────────────────

export function correoEventoPromocionado(datos: { negocio: Negocio; evento: { titulo: string; fecha_inicio: string }; pago: Pago }) {
  const { negocio, evento, pago } = datos;
  return correo({
    asunto: `Pago recibido: ${evento.titulo} ya está promocionado`,
    resumen: `${pago.importe}. Tu evento sale arriba en la agenda y en portada hasta que se celebre.`,
    titulo: "Tu evento ya está promocionado",
    parrafos: [
      `Hemos recibido el pago y ${n(evento.titulo)} sale ya arriba en la agenda y en la portada de Jaén Guía, con la etiqueta de promocionado, hasta que se celebre.`,
    ],
    detalles: detallesPago(pago, [
      ["Evento", evento.titulo],
      ["Fecha", fechaLarga(evento.fecha_inicio)],
      ["Negocio", negocio.nombre],
    ]),
    boton: botonFactura(pago) ?? { texto: "Ver mis eventos", url: panel(negocio, "#eventos") },
    notas: [
      pago.urlFactura ? `Tus eventos: <a href="${panel(negocio, "#eventos")}" style="color:inherit">panel de ${escapar(negocio.nombre)}</a>.` : "",
      "Si cambias la fecha del evento, la promoción se mueve con él.",
    ].filter(Boolean),
    motivo: MOTIVO_NEGOCIO(negocio),
  });
}

export function correoPlanActivado(datos: { negocio: Negocio; pago: Pago; finPeriodo: string | null }) {
  const { negocio, pago, finPeriodo } = datos;
  return correo({
    asunto: `${negocio.nombre} ya es Destacado en Jaén Guía`,
    resumen: `Plan activado. Portada, primero en su categoría y todos tus eventos promocionados.`,
    titulo: "Plan Destacado activado",
    parrafos: [
      `Hemos recibido el pago y ${n(negocio.nombre)} ya es Destacado: sale en la portada, el primero en su categoría, con insignia en la ficha, y todos tus eventos publicados van promocionados automáticamente.`,
      "Se renueva cada mes con la misma tarjeta. Sin permanencia: puedes cancelar cuando quieras desde el panel y sigues Destacado hasta el final del mes pagado.",
    ],
    detalles: detallesPago(pago, [
      ["Plan", `Destacado, ${PRECIO_PLAN_DESTACADO}`],
      ...(finPeriodo ? ([["Próxima renovación", fechaCorta(finPeriodo)]] as [string, string][]) : []),
    ]),
    boton: botonFactura(pago) ?? { texto: "Ir al panel", url: panel(negocio) },
    notas: [
      `Gestionar la suscripción (tarjeta, facturas, cancelar): <a href="${panel(negocio)}/suscripcion" style="color:inherit">panel → suscripción</a>.`,
    ],
    motivo: MOTIVO_NEGOCIO(negocio),
  });
}

export function correoRenovacion(datos: { negocio: Negocio; pago: Pago; finPeriodo: string | null }) {
  const { negocio, pago, finPeriodo } = datos;
  return correo({
    asunto: `Renovación del plan Destacado de ${negocio.nombre}`,
    resumen: `${pago.importe} cobrados. Tu factura está lista.`,
    titulo: "Un mes más como Destacado",
    parrafos: [
      `Hemos renovado el plan Destacado de ${n(negocio.nombre)} un mes más. No tienes que hacer nada.`,
    ],
    detalles: detallesPago(pago, finPeriodo ? [["Válido hasta", fechaCorta(finPeriodo)]] : []),
    boton: botonFactura(pago) ?? { texto: "Ver mi suscripción", url: `${panel(negocio)}/suscripcion` },
    notas: [
      `Tarjeta, facturas anteriores o cancelar: <a href="${panel(negocio)}/suscripcion" style="color:inherit">panel → suscripción</a>.`,
    ],
    motivo: MOTIVO_NEGOCIO(negocio),
  });
}

export function correoTarjetaRechazada(datos: { negocio: Negocio; importe: string }) {
  const { negocio } = datos;
  return correo({
    asunto: `No hemos podido cobrar el plan Destacado de ${negocio.nombre}`,
    resumen: "Tu tarjeta ha rechazado el cobro. Sigues Destacado mientras lo reintentamos.",
    titulo: "El banco ha rechazado el cobro",
    parrafos: [
      `Al renovar el plan Destacado de ${n(negocio.nombre)} (${escapar(datos.importe)}) la tarjeta ha rechazado el pago. Suele ser una tarjeta caducada, sin saldo o un bloqueo del banco.`,
      "De momento no cambia nada: sigues siendo Destacado y volveremos a intentarlo durante los próximos días. Si el cobro no entra, el plan se pausará y el negocio volverá a la ficha gratuita.",
      "Lo más rápido es poner otra tarjeta desde el panel: el pago pendiente se cobra al momento.",
    ],
    boton: { texto: "Cambiar la tarjeta", url: `${panel(negocio)}/suscripcion` },
    motivo: MOTIVO_NEGOCIO(negocio),
  });
}

export function correoPlanPausadoImpago(negocio: Negocio) {
  return correo({
    asunto: `Plan Destacado pausado: ${negocio.nombre} vuelve a la ficha gratuita`,
    resumen: "No hemos conseguido cobrar la renovación. Puedes reactivarlo cuando quieras.",
    titulo: "Hemos pausado el plan Destacado",
    parrafos: [
      `Tras varios intentos no hemos podido cobrar la renovación de ${n(negocio.nombre)}, así que el plan Destacado queda pausado y el negocio vuelve a la ficha gratuita: sigue en la guía, con sus horarios, fotos y eventos, pero sin portada ni posición destacada.`,
      "No hay ninguna deuda ni penalización. Si quieres volver a ser Destacado, pon una tarjeta válida y paga la factura pendiente desde el panel; se reactiva en el acto.",
    ],
    boton: { texto: "Reactivar el plan", url: `${panel(negocio)}/suscripcion` },
    motivo: MOTIVO_NEGOCIO(negocio),
  });
}

export function correoCancelacionProgramada(datos: { negocio: Negocio; finPeriodo: string | null }) {
  const { negocio, finPeriodo } = datos;
  const hasta = finPeriodo ? `hasta el ${fechaCorta(finPeriodo)}` : "hasta el final del mes pagado";
  return correo({
    asunto: `Cancelación del plan Destacado de ${negocio.nombre}`,
    resumen: `Sigues Destacado ${hasta}. No se cobrará nada más.`,
    titulo: "Suscripción cancelada",
    parrafos: [
      `Hemos anotado la cancelación del plan Destacado de ${n(negocio.nombre)}. Sigues siendo Destacado ${hasta}, que es lo que ya está pagado, y no se cobrará nada más.`,
      "Si cambias de idea antes de esa fecha, puedes reanudarla desde el panel y todo sigue igual, sin volver a pasar por el pago.",
      "Y si ha sido por algo que podemos mejorar, respóndenos a este correo: leemos todo.",
    ],
    detalles: finPeriodo ? [["Destacado hasta", fechaCorta(finPeriodo)]] : undefined,
    boton: { texto: "Reanudar la suscripción", url: `${panel(negocio)}/suscripcion` },
    motivo: MOTIVO_NEGOCIO(negocio),
  });
}

export function correoSuscripcionReanudada(datos: { negocio: Negocio; finPeriodo: string | null }) {
  const { negocio, finPeriodo } = datos;
  return correo({
    asunto: `Plan Destacado de ${negocio.nombre} reanudado`,
    resumen: "Se renovará con normalidad.",
    titulo: "Suscripción reanudada",
    parrafos: [
      `La suscripción de ${n(negocio.nombre)} vuelve a estar activa: se renovará con normalidad${finPeriodo ? ` el ${escapar(fechaCorta(finPeriodo))}` : ""} con la tarjeta guardada.`,
    ],
    boton: { texto: "Ver mi suscripción", url: `${panel(negocio)}/suscripcion` },
    motivo: MOTIVO_NEGOCIO(negocio),
  });
}

export function correoSuscripcionFinalizada(datos: { negocio: Negocio; motivo: "solicitud" | "impago" }) {
  const { negocio } = datos;
  const porque =
    datos.motivo === "impago"
      ? "no hemos conseguido cobrar la renovación tras varios intentos"
      : "así lo pediste";
  return correo({
    asunto: `${negocio.nombre} vuelve a la ficha gratuita`,
    resumen: "El plan Destacado ha terminado. Todo lo demás sigue igual.",
    titulo: "El plan Destacado ha terminado",
    parrafos: [
      `El plan Destacado de ${n(negocio.nombre)} ha terminado porque ${porque}. El negocio sigue en Jaén Guía con su ficha gratuita: horarios, fotos, reseñas y eventos; lo que deja de tener es la portada y la posición destacada.`,
      "Puedes volver a ser Destacado cuando quieras desde el panel, sin permanencia.",
    ],
    boton: { texto: "Volver a ser Destacado", url: panel(negocio) },
    motivo: MOTIVO_NEGOCIO(negocio),
  });
}

// ── Avisos internos (admin) ───────────────────────────────────────────

export function correoAdminPagoRecibido(datos: { negocio: Negocio; concepto: string; pago: Pago; email: string | null }) {
  const { negocio, pago } = datos;
  return correo({
    asunto: `Cobro: ${pago.importe} · ${datos.concepto} · ${negocio.nombre}`,
    resumen: `${negocio.nombre} ha pagado ${pago.importe}.`,
    titulo: "Pago recibido",
    parrafos: [`${n(negocio.nombre)} ha pagado ${n(pago.importe)} por ${escapar(datos.concepto)}.`],
    detalles: [
      ["Negocio", negocio.nombre],
      ["Concepto", datos.concepto],
      ["Importe", `${pago.importe} (IVA incluido)`],
      ["Factura", pago.numeroFactura ?? "—"],
      ["Cliente", datos.email ?? "—"],
    ],
    boton: pago.urlFactura ? { texto: "Ver factura", url: pago.urlFactura } : { texto: "Ver el negocio", url: `${urlSitio()}/negocio/${negocio.slug}` },
    motivo: "Aviso interno para el administrador de Jaén Guía.",
  });
}
