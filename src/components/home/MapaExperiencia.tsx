import Link from "next/link";
import { MapPinOff, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AnimatedSection from "@/components/motion/AnimatedSection";
import EstadoVacio from "./EstadoVacio";
import MapaImprescindibles from "./MapaImprescindibles";
import ImagenNegocio from "@/components/ImagenNegocio";
import type { PuntoMapa } from "./MapaLeaflet";

// Orden de la "ruta recomendada": un paseo por el casco antiguo de
// arriba abajo. Lo que sea imprescindible y no esté aquí va detrás, por
// nombre. Se marca en la base (negocios.es_imprescindible); esto solo
// decide el orden.
const RUTA = [
  "castillo-de-santa-catalina",
  "cruz-del-castillo-de-santa-catalina",
  "catedral-de-la-asuncion-de-la-virgen-de-jaen",
  "basilica-de-san-ildefonso",
  "centro-cultural-banos-arabes-palacio-de-villardompardo",
  "arco-de-san-lorenzo",
  "museo-ibero",
  "museo-de-jaen",
];

interface Imprescindible {
  id: string;
  nombre: string;
  slug: string;
  lat: number;
  lng: number;
  descripcion_corta: string | null;
  tipo_cocina: string[];
  imagen_portada: string | null;
  google_photo_name: string | null;
  google_photo_atribucion: string | null;
}

async function getImprescindibles(): Promise<Imprescindible[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("negocios")
    .select("id, nombre, slug, lat, lng, descripcion_corta, tipo_cocina, imagen_portada, google_photo_name, google_photo_atribucion")
    .eq("es_imprescindible", true)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("nombre")
    .returns<Imprescindible[]>();

  if (error || !data) return [];

  const posicion = (slug: string) => {
    const i = RUTA.indexOf(slug);
    return i === -1 ? RUTA.length : i;
  };
  return [...data].sort((a, b) => posicion(a.slug) - posicion(b.slug));
}

export default async function MapaExperiencia() {
  const imprescindibles = await getImprescindibles();
  const puntos: PuntoMapa[] = imprescindibles.map((n, i) => ({
    nombre: n.nombre,
    slug: n.slug,
    lat: n.lat,
    lng: n.lng,
    numero: i + 1,
  }));

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
            <div className="lg:col-span-8 min-h-80 overflow-hidden rounded-[1.5rem] bg-tierra-50 border border-oliva-100/50">
              <MapaImprescindibles puntos={puntos} />
            </div>

            <aside className="lg:col-span-4 flex flex-col justify-center px-2 py-4 md:px-6">
              <h3 className="font-sans text-xl font-bold text-oliva-900 mb-6">
                Ruta recomendada
              </h3>
              <ol className="flex flex-col gap-2">
                {imprescindibles.map((sitio, i) => (
                  <li key={sitio.slug} className="group relative">
                    <Link
                      href={`/negocio/${sitio.slug}`}
                      className="flex min-h-11 items-center gap-3 rounded-2xl p-2 -mx-2 hover:bg-tierra-50 transition-colors"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-oliva-900 text-xs font-bold text-white group-hover:bg-terracota-600 transition-colors">
                        {i + 1}
                      </span>
                      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                        <ImagenNegocio
                          negocioId={sitio.id}
                          nombre={sitio.nombre}
                          imagenPortada={sitio.imagen_portada}
                          googlePhotoName={sitio.google_photo_name}
                          googlePhotoAtribucion={null}
                        />
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="font-semibold leading-snug break-words text-oliva-900 group-hover:text-terracota-600 transition-colors">
                          {sitio.nombre}
                        </span>
                        <span className="mt-0.5 line-clamp-1 text-sm text-oliva-600">
                          {sitio.descripcion_corta ?? sitio.tipo_cocina[0] ?? "Ver ficha"}
                        </span>
                      </div>
                      <ArrowRight size={16} aria-hidden="true" className="ml-auto shrink-0 text-terracota-600 opacity-0 transition-opacity group-hover:opacity-100" />
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
