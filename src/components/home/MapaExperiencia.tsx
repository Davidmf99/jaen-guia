import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AnimatedSection from "@/components/motion/AnimatedSection";
import EstadoVacio from "./EstadoVacio";
import MapaImprescindibles from "./MapaImprescindibles";
import type { PuntoMapa } from "./MapaLeaflet";

// Componente de servidor: antes era "use client" solo para poder hacer
// el dynamic() de Leaflet, y por eso los datos estaban hardcodeados. El
// dynamic() vive ahora en MapaImprescindibles, así que aquí ya se puede
// consultar Supabase.
async function getImprescindibles(): Promise<PuntoMapa[]> {
  const supabase = await createClient();

  // Una sola consulta para el mapa Y para la lista: antes eran dos
  // constantes distintas (PUNTOS_MOCK e IMPRESCINDIBLES_MOCK) que se
  // contradecían entre sí — los marcadores incluían "Mesón Panaceite" y
  // la lista, "Baños Árabes".
  //
  // Sin lat o lng no se puede pintar el marcador: filtrarlos aquí evita
  // que Leaflet los coloque en el (0,0), en el golfo de Guinea.
  //
  // El filtro de activo lo aplica ya la RLS de negocios
  // ("Negocios visibles para todos" using activo = true).
  const { data, error } = await supabase
    .from("negocios")
    .select("nombre, slug, lat, lng")
    .eq("es_imprescindible", true)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("nombre")
    .returns<{ nombre: string; slug: string; lat: number; lng: number }[]>();

  if (error || !data) return [];

  return data.map((negocio) => ({
    nombre: negocio.nombre,
    slug: negocio.slug,
    lat: negocio.lat,
    lng: negocio.lng,
  }));
}

export default async function MapaExperiencia() {
  const puntos = await getImprescindibles();

  return (
    <AnimatedSection className="bg-tierra-200 py-16">
      <div className="mx-auto max-w-6xl px-6">
        {puntos.length === 0 ? (
          <EstadoVacio
            mensaje="Todavía no hay lugares imprescindibles en el mapa"
            icono={MapPinOff}
          />
        ) : (
          /* 1 columna en mobile (mapa arriba, lista debajo); a partir de
             md, 2 columnas reales lado a lado (grid-cols-5 solo para
             repartir 3/2 en vez de un 50/50 exacto, no como cuadrícula de
             5 elementos). */
          <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
            <div className="md:col-span-3">
              <MapaImprescindibles puntos={puntos} />
            </div>

            <aside className="rounded-2xl bg-white p-4 shadow-sm md:col-span-2">
              <h3 className="font-display text-lg font-semibold text-oliva-900">
                Mapa de la Experiencia
              </h3>
              <p className="mt-1 text-xs font-medium text-oliva-600">
                Lugares Imprescindibles
              </p>
              <ol className="mt-2 space-y-2 text-sm text-oliva-700">
                {puntos.map((punto, i) => (
                  <li key={punto.slug ?? punto.nombre} className="flex gap-2">
                    <span className="font-semibold text-terracota-600">
                      {i + 1}.
                    </span>
                    <Link
                      href={`/negocio/${punto.slug}`}
                      className="hover:text-terracota-600 transition-colors"
                    >
                      {punto.nombre}
                    </Link>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        )}
      </div>
    </AnimatedSection>
  );
}
