"use client";

import dynamic from "next/dynamic";
import AnimatedSection from "@/components/motion/AnimatedSection";

// Leaflet necesita `window`, así que el mapa se carga solo en cliente
const MapaLeaflet = dynamic(() => import("./MapaLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="h-80 w-full animate-pulse rounded-2xl bg-oliva-100" />
  ),
});

// Datos de ejemplo (mock). Sustituir por fetch a Supabase:
// select nombre, lat, lng from negocios where es_imprescindible = true or destacado = true
const PUNTOS_MOCK = [
  { nombre: "Catedral de Jaén", lat: 37.7695, lng: -3.7907 },
  { nombre: "Castillo de Santa Catalina", lat: 37.7628, lng: -3.8054 },
  { nombre: "Mesón Panaceite", lat: 37.7712, lng: -3.7891 },
];

const IMPRESCINDIBLES_MOCK = [
  "Catedral de Jaén",
  "Castillo de Santa Catalina",
  "Baños Árabes y Palacio de Villardompardo",
];

export default function MapaExperiencia() {
  return (
    <AnimatedSection className="bg-tierra-200 py-16">
      <div className="mx-auto max-w-6xl px-6">
        {/* 1 columna en mobile (mapa arriba, lista debajo); a partir de
            md, 2 columnas reales lado a lado (grid-cols-5 solo para
            repartir 3/2 en vez de un 50/50 exacto, no como cuadrícula de
            5 elementos). */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
          <div className="md:col-span-3">
            <MapaLeaflet puntos={PUNTOS_MOCK} />
          </div>

          <aside className="rounded-2xl bg-white p-4 shadow-sm md:col-span-2">
            <h3 className="font-display text-lg font-semibold text-oliva-900">
              Mapa de la Experiencia
            </h3>
            <p className="mt-1 text-xs font-medium text-oliva-600">
              Lugares Imprescindibles
            </p>
            <ol className="mt-2 space-y-2 text-sm text-oliva-700">
              {IMPRESCINDIBLES_MOCK.map((lugar, i) => (
                <li key={lugar} className="flex gap-2">
                  <span className="font-semibold text-terracota-600">
                    {i + 1}.
                  </span>
                  {lugar}
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </AnimatedSection>
  );
}
