import Link from "next/link";
import { ArrowRight } from "lucide-react";
import AnimatedSection from "@/components/motion/AnimatedSection";

export default function EsenciaJaen() {
  return (
    <AnimatedSection className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="group relative overflow-hidden rounded-[2.5rem] bg-oliva-900 px-8 py-24 md:py-32 text-center shadow-2xl">
          
          {/* Fondo moderno: glow en vez de puntos fríos */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] max-w-[1000px] bg-[radial-gradient(ellipse_at_top,rgba(138,154,91,0.2)_0%,transparent_70%)] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_bottom_right,rgba(201,111,58,0.15)_0%,transparent_60%)] pointer-events-none" />

          {/* Textura sutil para darle calidad de material (ruido/grain) */}
          <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.04] mix-blend-overlay pointer-events-none" />

          <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center justify-center text-white">
            <span className="mb-4 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-bold tracking-[0.2em] uppercase text-oliva-100 backdrop-blur-sm">
              Identidad
            </span>
            <h2 className="font-display text-5xl md:text-7xl font-semibold tracking-tight mb-6">
              La Esencia de Jaén
            </h2>
            <p className="mb-10 text-lg md:text-xl text-oliva-100/90 leading-relaxed">
              Un paisaje patrimonio de la humanidad, cultura milenaria y vida.
              Sumérgete en el mayor olivar del mundo y descubre nuestras raíces.
            </p>
            
            <Link
              href="/naturaleza"
              className="relative overflow-hidden rounded-full bg-white px-8 py-4 text-sm font-bold text-oliva-900 transition-transform hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_40px_rgba(255,255,255,0.1)]"
            >
              <span className="flex items-center gap-2">
                Ver planes de naturaleza
                <ArrowRight size={16} strokeWidth={2.5} />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
