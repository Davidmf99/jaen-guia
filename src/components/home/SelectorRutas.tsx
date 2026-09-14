"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Footprints } from "lucide-react";
import ImagenNegocio from "@/components/ImagenNegocio";
import MapaImprescindibles from "./MapaImprescindibles";
import { resumenRuta } from "@/lib/rutas-paseo";

export interface ParadaRuta {
  id: string;
  nombre: string;
  slug: string;
  lat: number;
  lng: number;
  detalle: string;
  imagen_portada: string | null;
  google_photo_name: string | null;
}

export interface RutaResuelta {
  clave: string;
  nombre: string;
  descripcion: string;
  paradas: ParadaRuta[];
}

// Selector de ruta + mapa + lista. Cliente solo por la pestaña activa;
// los datos llegan resueltos del servidor (MapaExperiencia). El mapa
// tiene altura fija y la lista hace scroll dentro de esa altura: con
// ocho paradas la lista era más alta que la pantalla y el mapa se
// estiraba con ella.
const ALTO = "h-[520px]";

export default function SelectorRutas({ rutas }: { rutas: RutaResuelta[] }) {
  const [activa, setActiva] = useState(rutas[0]?.clave);
  const ruta = rutas.find((r) => r.clave === activa) ?? rutas[0];
  if (!ruta) return null;

  const puntos = ruta.paradas.map((p, i) => ({ nombre: p.nombre, slug: p.slug, lat: p.lat, lng: p.lng, numero: i + 1 }));

  return (
    <>
      <div role="tablist" aria-label="Ruta" className="mb-5 flex flex-wrap gap-2">
        {rutas.map((r) => {
          const activo = r.clave === ruta.clave;
          return (
            <button
              key={r.clave}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setActiva(r.clave)}
              className={`inline-flex min-h-11 items-center rounded-full px-4 text-base font-medium transition-colors ${
                activo ? "bg-oliva-600 text-white" : "border border-oliva-100 text-oliva-700 hover:bg-oliva-100"
              }`}
            >
              {r.nombre}
              <span className={`ml-1.5 ${activo ? "text-white/80" : "text-oliva-500"}`}>{r.paradas.length}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 rounded-[2rem] border border-oliva-100 bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] md:p-6 lg:grid-cols-12">
        <div className={`${ALTO} overflow-hidden rounded-[1.5rem] border border-oliva-100/50 bg-tierra-50 lg:col-span-7`}>
          {/* key: al cambiar de ruta se vuelve a montar el mapa y se encuadra a las paradas nuevas. */}
          <MapaImprescindibles key={ruta.clave} puntos={puntos} linea />
        </div>

        <aside className={`${ALTO} flex flex-col lg:col-span-5`}>
          <div className="mb-3 px-1">
            <h3 className="font-sans text-xl font-bold text-oliva-900">{ruta.nombre}</h3>
            <p className="mt-1 text-sm text-oliva-600">{ruta.descripcion}</p>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-oliva-700">
              <Footprints size={16} aria-hidden="true" className="text-oliva-500" />
              {resumenRuta(ruta.paradas)} · {ruta.paradas.length} paradas
            </p>
          </div>
          <ol className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {ruta.paradas.map((parada, i) => (
              <li key={parada.slug} className="group relative">
                <Link
                  href={`/negocio/${parada.slug}`}
                  className="flex min-h-11 items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-tierra-50"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-oliva-900 text-xs font-bold text-white transition-colors group-hover:bg-terracota-600">
                    {i + 1}
                  </span>
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                    <ImagenNegocio
                      negocioId={parada.id}
                      nombre={parada.nombre}
                      imagenPortada={parada.imagen_portada}
                      googlePhotoName={parada.google_photo_name}
                      googlePhotoAtribucion={null}
                    />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold leading-snug text-oliva-900 transition-colors group-hover:text-terracota-600">
                      {parada.nombre}
                    </span>
                    <span className="truncate text-sm text-oliva-600">{parada.detalle}</span>
                  </div>
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                    className="ml-auto shrink-0 text-terracota-600 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
