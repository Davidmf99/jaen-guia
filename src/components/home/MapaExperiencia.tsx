import { MapPinOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AnimatedSection from "@/components/motion/AnimatedSection";
import EstadoVacio from "./EstadoVacio";
import SelectorRutas, { type ParadaRuta, type RutaResuelta } from "./SelectorRutas";
import { RUTAS } from "@/lib/rutas-paseo";

interface Fila {
  id: string;
  nombre: string;
  slug: string;
  lat: number;
  lng: number;
  descripcion_corta: string | null;
  tipo_cocina: string[];
  imagen_portada: string | null;
  google_photo_name: string | null;
}

// Las rutas están definidas en lib/rutas-paseo.ts como listas de slugs;
// aquí se resuelven contra la base de una vez (una consulta con todos
// los slugs) y se pasan ya montadas al selector, que es cliente.
async function getRutas(): Promise<RutaResuelta[]> {
  const supabase = await createClient();
  const slugs = [...new Set(RUTAS.flatMap((r) => r.paradas))];

  const { data, error } = await supabase
    .from("negocios")
    .select("id, nombre, slug, lat, lng, descripcion_corta, tipo_cocina, imagen_portada, google_photo_name")
    .in("slug", slugs)
    .eq("activo", true)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .returns<Fila[]>();
  if (error || !data) return [];

  const porSlug = new Map(data.map((f) => [f.slug, f]));
  return RUTAS.map((ruta) => ({
    clave: ruta.clave,
    nombre: ruta.nombre,
    descripcion: ruta.descripcion,
    paradas: ruta.paradas.flatMap((slug): ParadaRuta[] => {
      const f = porSlug.get(slug);
      if (!f) return [];
      return [
        {
          id: f.id,
          nombre: f.nombre,
          slug: f.slug,
          lat: f.lat,
          lng: f.lng,
          detalle: f.descripcion_corta ?? f.tipo_cocina[0] ?? "Ver ficha",
          imagen_portada: f.imagen_portada,
          google_photo_name: f.google_photo_name,
        },
      ];
    }),
  })).filter((r) => r.paradas.length >= 2);
}

export default async function MapaExperiencia() {
  const rutas = await getRutas();

  return (
    <AnimatedSection className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-8 max-w-2xl">
          <h2 className="mb-3 font-sans text-3xl font-bold tracking-tight text-oliva-900 md:text-4xl">
            Rutas a pie por Jaén
          </h2>
          <p className="text-lg text-oliva-600">
            Tres paseos con lo imprescindible, en el orden en que se hacen de verdad.
          </p>
        </div>

        {rutas.length === 0 ? (
          <EstadoVacio mensaje="Todavía no hay rutas en el mapa" icono={MapPinOff} />
        ) : (
          <SelectorRutas rutas={rutas} />
        )}
      </div>
    </AnimatedSection>
  );
}
