import { createClient } from "@/lib/supabase/server";
import { getMunicipioCapitalId } from "@/lib/municipios";
import { getUltimaActualizacion, textoActualizacion } from "@/lib/eventos-actualizacion";
import AnimatedSection from "@/components/motion/AnimatedSection";
import AgendaCortes, { type GrupoAgenda } from "./AgendaCortes";
import type { EventoTarjeta } from "./EventoCard";
import {
  creditoFuente,
  estaPromocionado,
  etiquetaFecha,
  filtroEventosEnRango,
  filtroEventosVigentes,
  limiteVentanaPromocion,
  rangoTemporal,
  type CorteTemporal,
} from "@/lib/eventos";
import type { Categoria } from "@/types";

// Dos filas completas de la rejilla de 3 columnas.
const MAX_EVENTOS = 6;

interface EventoRow {
  id: string;
  slug: string;
  titulo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  es_todo_el_dia: boolean;
  es_gratis: boolean;
  imagen: string | null;
  lugar_nombre: string | null;
  origen: string;
  fuente_nombre: string | null;
  fuente_url: string | null;
  promocionado_hasta: string | null;
  categoria: { nombre: string; tipo: Categoria["tipo"] } | null;
  negocio: { nombre: string } | null;
}

/**
 * Eventos de un corte temporal, o los próximos vigentes si no se pasa
 * ninguno. Solo 'publicado': los borradores ya los esconde la RLS, pero
 * 'cancelado' y 'aplazado' sí son públicos y no pintan nada en una lista
 * de "qué hago hoy" sin una etiqueta que explique su estado.
 *
 * Los promocionados van primero. Como hay LIMIT, no basta con reordenar
 * en memoria: un concierto pagado para dentro de diez días no entraría en
 * los seis primeros por fecha. Se traen aparte y se rellena con el resto.
 */
async function getEventos(corte?: CorteTemporal): Promise<{ eventos: EventoTarjeta[]; total: number }> {
  const supabase = await createClient();
  const capitalId = await getMunicipioCapitalId();
  const ahora = new Date();

  const COLUMNAS =
    "id, slug, titulo, fecha_inicio, fecha_fin, es_todo_el_dia, es_gratis, imagen, lugar_nombre, origen, fuente_nombre, fuente_url, promocionado_hasta, categoria:categorias(nombre, tipo), negocio:negocios(nombre)";
  // Los mismos filtros para las filas y para el recuento: la única
  // diferencia es el select.
  const consulta = (modo: "filas" | "recuento" = "filas") => {
    let q = (modo === "filas"
      ? supabase.from("eventos").select(COLUMNAS)
      : supabase.from("eventos").select("id", { count: "exact", head: true })
    ).eq("estado", "publicado");

    // Fase capital: los eventos de la provincia (los que trae la Agenda
    // Cultural de Andalucía de Martos, Villacarrillo, Bailén…) se quedan
    // guardados, pero aquí no se listan todavía.
    q = q.eq("municipio_id", capitalId);

    if (corte) {
      // Un corte ya es un subconjunto de los vigentes: rangoTemporal() nunca
      // devuelve un `desde` anterior a ahora.
      const { desde, hasta } = rangoTemporal(corte, ahora);
      q = q.lt("fecha_inicio", hasta).or(filtroEventosEnRango(desde));
    } else {
      q = q.or(filtroEventosVigentes());
    }

    return q;
  };
  const ordenada = (q: ReturnType<typeof consulta>) =>
    q.order("fecha_inicio", { ascending: true }).limit(MAX_EVENTOS).returns<EventoRow[]>();

  // El total real del corte, aparte del LIMIT: la pestaña enseña "Próximos
  // 47", no "6", que es lo que cabe en la rejilla.
  const [promocionados, resto, recuento] = await Promise.all([
    ordenada(
      consulta()
        .gt("promocionado_hasta", ahora.toISOString())
        .lt("fecha_inicio", limiteVentanaPromocion(ahora))
    ),
    ordenada(consulta()),
    consulta("recuento"),
  ]);

  if (promocionados.error || resto.error) return { eventos: [], total: 0 };

  const vistos = new Set<string>();
  const filas: EventoRow[] = [];
  for (const evento of [...promocionados.data, ...resto.data]) {
    if (vistos.has(evento.id)) continue;
    vistos.add(evento.id);
    filas.push(evento);
  }

  const eventos = filas.slice(0, MAX_EVENTOS).map((evento) => ({
    id: evento.id,
    slug: evento.slug,
    titulo: evento.titulo,
    fecha_inicio: evento.fecha_inicio,
    fechaTexto: etiquetaFecha(
      evento.fecha_inicio,
      evento.fecha_fin,
      evento.es_todo_el_dia,
      ahora
    ),
    es_todo_el_dia: evento.es_todo_el_dia,
    es_gratis: evento.es_gratis,
    imagen: evento.imagen,
    // Los eventos de agenda oficial traen lugar_nombre; los que publica
    // un negocio desde su panel normalmente no, y ahí el lugar es el
    // propio negocio.
    lugar: evento.lugar_nombre ?? evento.negocio?.nombre ?? null,
    // Solo los eventos de origen 'negocio' llevan la etiqueta: en los de
    // agenda oficial, negocio_id puede estar puesto para ubicar el evento
    // en un local sin que ese local lo organice.
    organizador:
      evento.origen === "negocio" ? evento.negocio?.nombre ?? null : null,
    fuente: creditoFuente(evento.fuente_nombre, evento.fuente_url),
    categoriaNombre: evento.categoria?.nombre ?? null,
    categoriaTipo: evento.categoria?.tipo ?? null,
    promocionado: estaPromocionado(evento.promocionado_hasta, evento.fecha_inicio, ahora),
  }));
  return { eventos, total: recuento.count ?? eventos.length };
}

export default async function EventosProximos() {
  // Los cuatro cortes de una vez: cambiar de pestaña no debe costar una
  // navegación. Son consultas pequeñas (6 filas como mucho cada una).
  const [hoy, manana, finde, proximos, ultima] = await Promise.all([
    getEventos("hoy"),
    getEventos("manana"),
    getEventos("finde"),
    getEventos(),
    getUltimaActualizacion(),
  ]);

  const grupos: GrupoAgenda[] = [
    { clave: "hoy", etiqueta: "Hoy", eventos: hoy.eventos, total: hoy.total, href: "/eventos?cuando=hoy" },
    { clave: "manana", etiqueta: "Mañana", eventos: manana.eventos, total: manana.total, href: "/eventos?cuando=manana" },
    { clave: "finde", etiqueta: "Este finde", eventos: finde.eventos, total: finde.total, href: "/eventos?cuando=finde" },
    { clave: "proximos", etiqueta: "Próximos", eventos: proximos.eventos, total: proximos.total, href: "/eventos" },
  ];

  return (
    // Pegada al hero a propósito. La agenda es lo que trae al usuario, y
    // con 96px de separación el primer evento caía a 1,66 pantallas de
    // scroll en un móvil de 360×640.
    <AnimatedSection className="pt-2 pb-12">
      <div className="mx-auto max-w-6xl px-6">
        <AgendaCortes grupos={grupos} actualizado={textoActualizacion(ultima)} />
      </div>
    </AnimatedSection>
  );
}
