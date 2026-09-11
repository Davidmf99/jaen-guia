import Link from "next/link";
import { MapPinOff, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AnimatedSection from "@/components/motion/AnimatedSection";
import EstadoVacio from "./EstadoVacio";
import MapaImprescindibles from "./MapaImprescindibles";
import type { PuntoMapa } from "./MapaLeaflet";

async function getImprescindibles(): Promise<PuntoMapa[]> {
  const supabase = await createClient();

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
    <AnimatedSection className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        
        <div className="mb-10 max-w-2xl">
          <h2 className="font-sans text-3xl md:text-4xl font-bold tracking-tight text-oliva-900 mb-3">
            Dónde está cada sitio
          </h2>
          <p className="text-lg text-oliva-600">
            Los lugares imprescindibles que no puedes perderte en tu visita a Jaén.
          </p>
        </div>

        {puntos.length === 0 ? (
          <EstadoVacio
            mensaje="Todavía no hay lugares imprescindibles en el mapa"
            icono={MapPinOff}
          />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 rounded-[2rem] bg-white p-4 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-oliva-100">
            <div className="lg:col-span-8 overflow-hidden rounded-[1.5rem] bg-tierra-50 border border-oliva-100/50">
              <MapaImprescindibles puntos={puntos} />
            </div>

            <aside className="lg:col-span-4 flex flex-col justify-center px-2 py-4 md:px-6">
              <h3 className="font-sans text-xl font-bold text-oliva-900 mb-6">
                Ruta recomendada
              </h3>
              <ol className="flex flex-col gap-4">
                {puntos.map((punto, i) => (
                  <li key={punto.slug ?? punto.nombre} className="group relative">
                    <Link
                      href={`/negocio/${punto.slug}`}
                      className="flex min-h-11 items-start gap-4 rounded-2xl p-3 -mx-3 hover:bg-tierra-50 transition-colors"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-oliva-100 text-sm font-bold text-oliva-900 group-hover:bg-terracota-600 group-hover:text-white transition-colors">
                        {i + 1}
                      </span>
                      <div className="flex min-w-0 flex-col pt-1">
                        <span className="font-semibold break-words text-oliva-900 group-hover:text-terracota-600 transition-colors">
                          {punto.nombre}
                        </span>
                        <span className="mt-1 flex items-center gap-1 text-sm font-medium text-terracota-600">
                          Ver detalles <ArrowRight size={14} aria-hidden="true" />
                        </span>
                      </div>
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
