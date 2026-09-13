import "server-only";
import { z } from "zod";

// Lee un cartel (imagen) y/o el texto que lo acompaña y saca los datos
// del evento. Es una sola llamada con salida estructurada: nada de
// agentes ni herramientas, el flujo lo controla el webhook.
//
// Va por OpenRouter (API compatible con OpenAI) para poder cambiar de
// modelo sin tocar código: basta con OPENROUTER_MODELO en el entorno.
//
// Salida en hora LOCAL de Jaén como texto ("2026-09-20T22:00"): la
// conversión a UTC la hace isoDesdeHoraJaen() en el webhook, igual
// que con el formulario del panel, para que las dos vías coincidan.

const EsquemaEvento = z.object({
  es_evento: z
    .boolean()
    .describe("true solo si el contenido anuncia algo que pasa en una fecha concreta (concierto, cata, cena, partido, taller...). false para menús, fotos del local, ofertas sin fecha o saludos."),
  confianza: z
    .enum(["alta", "media", "baja"])
    .describe("alta: título y fecha legibles sin ambigüedad. media: falta la hora o el año se ha supuesto. baja: se adivina algo."),
  titulo: z.string().describe("Nombre corto del evento, 3-80 caracteres, sin gritos en mayúsculas. Vacío si no es evento."),
  descripcion: z.string().describe("Resumen de 1-3 frases con lo que dice el cartel (artista, qué incluye, cómo reservar). Vacío si no hay más que el título."),
  fecha_inicio: z
    .string()
    .describe("Inicio en hora local de Jaén, formato YYYY-MM-DDTHH:mm. Si no hay hora, YYYY-MM-DDT00:00 y es_todo_el_dia=true. Vacío si no es evento."),
  fecha_fin: z.string().describe("Fin en el mismo formato, o vacío si no se indica. Para 'del 3 al 5 de octubre' es el último día."),
  es_todo_el_dia: z.boolean().describe("true si el cartel no da hora (ferias, exposiciones, jornadas)."),
  es_gratis: z.boolean().describe("true si dice gratis, entrada libre o similar."),
  precio_texto: z.string().describe("Precio tal cual aparece ('12 € anticipada / 15 € taquilla', 'consumición'). Vacío si no hay o es gratis."),
  lugar_nombre: z.string().describe("Nombre del sitio donde ocurre SOLO si el cartel lo dice y NO es el propio negocio remitente. Vacío en caso contrario."),
});

export type EventoExtraido = z.infer<typeof EsquemaEvento>;

const SISTEMA = `Eres el lector de carteles de Jaén Guía, una guía de ocio de Jaén (España).
Los dueños de bares, tiendas y salas reenvían por WhatsApp el cartel o la story que ya han publicado en Instagram. Tu trabajo es sacar los datos del evento para crear un borrador que el dueño confirmará después: no inventes nada que no esté en la imagen o el texto.

Reglas:
- Fechas en español y con formatos de cartel: "SÁB 20 SEPT", "20/09", "este viernes", "20.09.26". Resuelve el día de la semana y el año con la fecha de hoy que se te da: si la fecha ya pasó este año, asume el año que viene; "este viernes" es el próximo viernes a partir de hoy.
- Horas: "22h", "22:00", "10 de la noche", "a partir de las 20". Usa formato 24h.
- Si hay varias fechas (ciclo de conciertos), quédate con la primera y menciona el resto en la descripción.
- Si el contenido no anuncia nada con fecha (foto de la tapa del día, "abrimos a las 12", promoción permanente), es_evento=false.
- Título: lo que diría alguien al recomendarlo ("Concierto de Antonio Lizana", "Cata de aceites tempranos"), no el texto completo del cartel.`;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Sonnet 5 por coste (~0,01 $ por cartel frente a ~0,03 $ con Opus 5).
// Si las fechas salen mal con frecuencia, poner OPENROUTER_MODELO=anthropic/claude-opus-5.
const MODELO_POR_DEFECTO = "anthropic/claude-sonnet-5";

const FECHA_JAEN = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function mediaAdmitido(mime: string) {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime);
}

interface Entrada {
  negocioNombre: string;
  texto?: string | null;
  imagen?: { bytes: Buffer; mime: string } | null;
  ahora?: Date;
}

type ParteContenido =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface RespuestaChat {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  error?: { message?: string };
}

/**
 * Devuelve la extracción o null si no había nada que leer (ni texto ni
 * imagen admitida). Lanza si la API falla: el webhook decide qué hacer.
 */
export async function extraerEvento({ negocioNombre, texto, imagen, ahora = new Date() }: Entrada) {
  const clave = process.env.OPENROUTER_API_KEY;
  if (!clave) throw new Error("Falta OPENROUTER_API_KEY");

  const contenido: ParteContenido[] = [];

  if (imagen && mediaAdmitido(imagen.mime)) {
    contenido.push({
      type: "image_url",
      image_url: { url: `data:${imagen.mime};base64,${imagen.bytes.toString("base64")}` },
    });
  }

  const partes = [
    `Hoy es ${FECHA_JAEN.format(ahora)}.`,
    `El mensaje lo manda el negocio «${negocioNombre}».`,
    texto?.trim() ? `Texto del mensaje:\n${texto.trim()}` : "El mensaje no lleva texto, solo la imagen.",
  ];
  if (contenido.length === 0 && !texto?.trim()) return null;
  contenido.push({ type: "text", text: partes.join("\n\n") });

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://jaenguia.es",
      "X-Title": "Jaén Guía",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODELO || MODELO_POR_DEFECTO,
      max_tokens: 2048,
      reasoning: { effort: "medium" },
      // El sistema no cambia entre llamadas: OpenRouter lo cachea en los
      // modelos de Anthropic. La fecha va en el mensaje de usuario
      // justamente para no invalidar la caché.
      messages: [
        { role: "system", content: SISTEMA },
        { role: "user", content: contenido },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "evento", strict: true, schema: z.toJSONSchema(EsquemaEvento) },
      },
    }),
  });

  const datos = (await res.json().catch(() => ({}))) as RespuestaChat;
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${datos.error?.message ?? "sin detalle"}`);
  }

  const eleccion = datos.choices?.[0];
  if (eleccion?.message?.refusal) {
    throw new Error(`El modelo rechazó el contenido: ${eleccion.message.refusal}`);
  }
  const crudo = eleccion?.message?.content;
  if (!crudo) throw new Error(`OpenRouter no devolvió contenido (finish_reason=${eleccion?.finish_reason ?? "?"})`);

  return EsquemaEvento.parse(JSON.parse(crudo));
}
