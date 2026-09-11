import Link from "next/link";
import { MapPin, Store } from "lucide-react";
import ImagenEvento from "./ImagenEvento";
import type { Categoria } from "@/types";

export interface EventoTarjeta {
  id: string;
  slug: string;
  titulo: string;
  fecha_inicio: string;
  /** Ya formateada en el servidor: "Hoy a las 22:00", "Hasta el 25 de octubre"… */
  fechaTexto: string;
  es_todo_el_dia: boolean;
  es_gratis: boolean;
  imagen: string | null;
  /** lugar_nombre del evento o, si cuelga de un negocio, el del negocio. */
  lugar: string | null;
  /** Nombre del negocio que lo publica; null en la agenda oficial. */
  organizador: string | null;
  /** Agenda de la que viene el evento, cuando lo trae la sincronización. */
  fuente: { nombre: string; sitio: string } | null;
  categoriaNombre: string | null;
  categoriaTipo: Categoria["tipo"] | null;
}

interface Props {
  evento: EventoTarjeta;
}

// Componente de servidor desde que se retiró el escalonado de entrada.
// Antes era cliente y se servía con style="opacity:0", esperando a que
// un GridStagger lo pasara a "visible": sin JavaScript no se veía nada.
//
// Los tamaños de texto: la fecha es lo que trae al usuario a esta página,
// así que va a 16 px y no a los 12 px que tenía. Nada baja de 14 px.
export default function EventoCard({ evento }: Props) {
  return (
    <article className="group relative overflow-hidden rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Misma relación de aspecto que NegocioCard, para que las
          tarjetas de las dos secciones se lean como una sola retícula. */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <ImagenEvento
          imagen={evento.imagen}
          fechaInicio={evento.fecha_inicio}
          categoriaTipo={evento.categoriaTipo}
        />

        {evento.categoriaNombre && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-sm font-medium text-oliva-900">
            {evento.categoriaNombre}
          </span>
        )}

        {/* terracota-600 y no 500: con texto blanco encima, el 500 se
            quedaba en 3.61:1 y este chip va en negrita y pequeño. */}
        {evento.es_gratis && (
          <span className="absolute right-3 top-3 rounded-full bg-terracota-600 px-2.5 py-1 text-sm font-semibold text-white">
            Gratis
          </span>
        )}
      </div>

      <div className="p-4">
        <p className="text-base font-semibold text-terracota-600">
          {evento.fechaTexto}
        </p>
        <h3 className="mt-1 font-sans text-lg font-bold tracking-tight leading-snug text-oliva-900">
          {/* after:inset-0 estira el enlace sobre toda la tarjeta: el
              objetivo táctil deja de ser la línea de 22 px del título. */}
          <Link
            href={`/evento/${evento.slug}`}
            className="hover:text-terracota-600 transition-colors after:absolute after:inset-0"
          >
            {evento.titulo}
          </Link>
        </h3>
        {evento.lugar && (
          <p className="mt-1.5 flex items-center gap-1.5 text-base text-oliva-700">
            <MapPin
              size={16}
              aria-hidden="true"
              className="shrink-0 text-oliva-500"
            />
            <span className="truncate">{evento.lugar}</span>
          </p>
        )}

        {/* Solo los eventos publicados por el propio local. Distingue de un
            vistazo lo que cuenta un bar de lo que viene de agenda oficial. */}
        {evento.organizador && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-terracota-600">
            <Store size={15} aria-hidden="true" className="shrink-0" />
            <span className="truncate">Organizado por {evento.organizador}</span>
          </p>
        )}

        {/* Crédito a la agenda de origen. Va enlazado a su web y se suma
            al enlace a la ficha concreta, que está en la página del
            evento. Sale de la tarjeta, no del detalle, porque es donde
            la mayoría de la gente ve el evento. */}
        {/* El z-10 del párrafo lo pone por encima del enlace estirado del
            título; si no, este enlace externo no se podría pulsar. */}
        {evento.fuente && (
          <p className="relative z-10 mt-2 text-sm text-oliva-600">
            vía{" "}
            <a
              href={evento.fuente.sitio}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-semibold text-oliva-700 underline decoration-oliva-400 underline-offset-2 hover:text-terracota-600"
            >
              {evento.fuente.nombre}
            </a>
          </p>
        )}
      </div>
    </article>
  );
}
