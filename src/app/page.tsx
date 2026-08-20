import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Hero from "@/components/home/Hero";
import BentoDestacados from "@/components/home/BentoDestacados";
import EventosProximos from "@/components/home/EventosProximos";
import EsenciaJaen from "@/components/home/EsenciaJaen";
import MapaExperiencia from "@/components/home/MapaExperiencia";

// Coincide a propósito con el metadata por defecto de layout.tsx: se
// declara aquí también para que "/" siga el mismo patrón explícito que
// el resto de rutas (todas exportan su propio metadata/generateMetadata).
export const metadata: Metadata = {
  title: "Jaén Guía · Alma de la Tierra",
  description:
    "Guía de gastronomía, cultura y ocio de Jaén: descubre bares, tiendas, eventos y experiencias, hechas por y para jiennenses y visitantes.",
};

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <BentoDestacados />
        <EventosProximos />
        <EsenciaJaen />
        <MapaExperiencia />
      </main>
    </>
  );
}
