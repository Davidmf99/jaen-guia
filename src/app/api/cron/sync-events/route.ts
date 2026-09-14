import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { pareceRepetido } from "@/lib/eventos-repetidos";
import { FUENTES, type EventoImportado } from "@/lib/fuentes";
import { slugImportado } from "@/lib/fuentes/tipos";

// Node y no edge: se usa node:crypto y el cliente de Supabase con la
// service role key, que nunca debe salir de un entorno de servidor.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Tres agendas externas en serie pueden pasar de los 10s por defecto del
// plan Hobby de Vercel.
export const maxDuration = 60;

interface ResumenFuente {
  fuente: string;
  encontrados: number;
  nuevos: number;
  actualizados: number;
  descartados: number;
  error?: string;
}

/** Comparación en tiempo constante: no filtra el secreto carácter a carácter. */
function secretoValido(cabecera: string | null, secreto: string) {
  const recibido = Buffer.from((cabecera ?? "").replace(/^Bearer\s+/i, ""));
  const esperado = Buffer.from(secreto);
  if (recibido.length !== esperado.length) return false;
  return timingSafeEqual(recibido, esperado);
}

function normalizarNombre(nombre: string) {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secreto || !url || !servicio) {
    return NextResponse.json(
      { error: "Faltan CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  if (!secretoValido(request.headers.get("authorization"), secreto)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Service role: salta la RLS, así que este cliente jamás debe crearse
  // fuera de esta ruta protegida.
  const supabase = createClient(url, servicio, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: municipios } = await supabase
    .from("municipios")
    .select("id, nombre")
    .returns<{ id: string; nombre: string }[]>();

  const porMunicipio = new Map(
    (municipios ?? []).map((m) => [normalizarNombre(m.nombre), m.id])
  );

  /**
   * Id del municipio, dándolo de alta si la agenda trae uno que todavía
   * no está en el catálogo.
   *
   * Antes, un municipio desconocido se dejaba al DEFAULT de la columna
   * —Jaén capital— y un concierto en Villacarrillo entraba como si fuera
   * de la capital. Como `municipios` solo tenía la fila de Jaén, eso le
   * pasaba a TODO lo de la provincia. Aquí se crea la fila que falte:
   * el catálogo crece solo con los municipios que aparecen de verdad.
   */
  async function idDeMunicipio(nombre: string | null | undefined) {
    if (!nombre) return null;

    const clave = normalizarNombre(nombre);
    if (!clave) return null;

    const conocido = porMunicipio.get(clave);
    if (conocido) return conocido;

    const { data } = await supabase
      .from("municipios")
      .upsert(
        { nombre: nombre.trim(), slug: clave.replace(/ /g, "-") },
        { onConflict: "slug" }
      )
      .select("id")
      .maybeSingle();

    if (data?.id) porMunicipio.set(clave, data.id);
    return data?.id ?? null;
  }

  const ahora = new Date().toISOString();

  // Las agendas no traen categoría. Se deduce del título con palabras
  // clave hacia una de las cinco de la guía; en la duda, cultura, que es
  // lo que suelen publicar la UJA, la Junta y EnJaén. Sirve para el
  // color del hueco sin foto, la etiqueta de la tarjeta y el filtro.
  const { data: categorias } = await supabase.from("categorias").select("id, slug").returns<{ id: string; slug: string }[]>();
  const categoriaId = (slug: string) => (categorias ?? []).find((c) => c.slug === slug)?.id ?? null;
  const REGLAS: Array<[RegExp, string]> = [
    [/\b(ruta|senderis|marcha|excursi[oó]n|natur|parque|sierra|berrea|astron|estrellas)\b/i, "naturaleza"],
    [/\b(cata|gastro|tapas?|degustaci[oó]n|vino|aceite|cerveza|cocina|men[uú])\b/i, "gastronomia"],
    [/\b(mercado|mercadillo|feria|fiestas?|verbena|taller|deporte|carrera|torneo|partido|infantil|ni[nñ]os|familiar|magia|escape|juegos?)\b/i, "experiencias"],
  ];
  const categoriaDe = (titulo: string) => {
    for (const [re, slug] of REGLAS) if (re.test(titulo)) return categoriaId(slug);
    return categoriaId("cultura");
  };

  async function guardar(
    evento: EventoImportado,
    fuenteNombre: string
  ): Promise<"nuevo" | "actualizado" | "descartado"> {
    // Lo que ya terminó no entra: la agenda es para decidir qué hacer.
    if ((evento.fechaFin ?? evento.fechaInicio) < ahora) return "descartado";

    const municipioId = await idDeMunicipio(evento.municipioNombre);

    // Estable entre ejecuciones: mismo evento, mismo slug.
    const sufijo = createHash("sha1").update(evento.url).digest("hex").slice(0, 8);

    const fila = {
      titulo: evento.titulo,
      slug: slugImportado(evento.titulo, evento.url, sufijo),
      fecha_inicio: evento.fechaInicio,
      fecha_fin: evento.fechaFin ?? null,
      es_todo_el_dia: evento.esTodoElDia,
      lugar_nombre: evento.lugarNombre ?? null,
      origen: "scraper",
      estado: "publicado",
      fuente_nombre: fuenteNombre,
      fuente_url: evento.url,
      categoria_id: categoriaDe(evento.titulo),
      imagen: evento.imagenUrl ?? null,
      // Solo si la fuente dice el municipio. Si no lo dice, se deja el
      // default de la tabla (la capital): las agendas municipales de Jaén
      // no lo repiten en cada evento.
      ...(municipioId ? { municipio_id: municipioId } : {}),
    };

    // fuente_url identifica la ficha original: si ya la importamos, esta
    // es la misma actividad aunque le hayan cambiado el título o la fecha.
    const { data: existente } = await supabase
      .from("eventos")
      .select("id")
      .eq("fuente_url", evento.url)
      .maybeSingle();

    if (existente) {
      await supabase.from("eventos").update(fila).eq("id", existente.id);
      return "actualizado";
    }

    // Y si ya entró por otra vía con otras palabras (un post de Facebook
    // del mismo acto), tampoco: mismo día y sitio, títulos parecidos.
    if (await pareceRepetido(supabase, { titulo: fila.titulo, fecha_inicio: fila.fecha_inicio, lugar_nombre: fila.lugar_nombre })) {
      return "descartado";
    }

    // ignoreDuplicates y no merge: si la huella (municipio + día +
    // título) ya existe, el evento lo metió antes un negocio o un admin y
    // el scraper no debe pisarle su ficha.
    const { error } = await supabase
      .from("eventos")
      .upsert(fila, { onConflict: "huella", ignoreDuplicates: true });

    return error ? "descartado" : "nuevo";
  }

  const resultados = await Promise.allSettled(
    FUENTES.map(async (fuente): Promise<ResumenFuente> => {
      const eventos = await fuente.obtener();
      const resumen: ResumenFuente = {
        fuente: fuente.clave,
        encontrados: eventos.length,
        nuevos: 0,
        actualizados: 0,
        descartados: 0,
      };

      // En serie dentro de cada fuente: son pocas filas y así no se
      // abren decenas de conexiones a Supabase a la vez.
      for (const evento of eventos) {
        const resultado = await guardar(evento, fuente.nombre);
        if (resultado === "nuevo") resumen.nuevos += 1;
        else if (resultado === "actualizado") resumen.actualizados += 1;
        else resumen.descartados += 1;
      }

      return resumen;
    })
  );

  const resumen: ResumenFuente[] = resultados.map((resultado, i) =>
    resultado.status === "fulfilled"
      ? resultado.value
      : {
          fuente: FUENTES[i].clave,
          encontrados: 0,
          nuevos: 0,
          actualizados: 0,
          descartados: 0,
          // Una agenda caída no puede tumbar a las demás: se anota y sigue.
          error: String(resultado.reason?.message ?? resultado.reason),
        }
  );

  const cambios = resumen.reduce((t, r) => t + r.nuevos + r.actualizados, 0);
  if (cambios > 0) {
    revalidatePath("/");
    revalidatePath("/eventos");
  }

  return NextResponse.json({ sincronizado: ahora, cambios, fuentes: resumen });
}
