import type { Metadata } from "next";
import Hero from "@/components/home/Hero";
import BentoDestacados from "@/components/home/BentoDestacados";
import EventosProximos from "@/components/home/EventosProximos";
import EsenciaJaen from "@/components/home/EsenciaJaen";
import MapaExperiencia from "@/components/home/MapaExperiencia";
import { getCategorias } from "@/lib/categorias";

// Coincide a propósito con el metadata por defecto de layout.tsx: se
// declara aquí también para que "/" siga el mismo patrón explícito que
// el resto de rutas (todas exportan su propio metadata/generateMetadata).
export const metadata: Metadata = {
  title: "Jaén Guía · Alma de la Tierra",
  description:
    "Guía de gastronomía, cultura y ocio de Jaén: descubre bares, tiendas, eventos y experiencias, hechas por y para jiennenses y visitantes.",
};

export default async function HomePage() {
  // Los chips del buscador salen de la base, no de una lista escrita a
  // mano que se quedaba desfasada.
  const categorias = await getCategorias();

  return (
    <>
      <main>
        <Hero categorias={categorias} />
        {/* Eventos primero: es lo único con fecha, lo único que responde
            a "qué hago hoy". Destacados es contenido atemporal y queda
            como plan B. El mapa convierte el "qué hago" en "dónde voy",
            y la Esencia cierra: es identidad de marca, no ayuda a
            decidir nada. */}
        <EventosProximos />
        <BentoDestacados />
        <MapaExperiencia />
        <EsenciaJaen />
      </main>
    </>
  );
}
