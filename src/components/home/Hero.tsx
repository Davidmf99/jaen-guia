"use client";

import Link from "next/link";
import {
  Search,
  MapPin,
  UtensilsCrossed,
  Landmark,
  Trees,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import type { CategoriaNav } from "@/lib/categorias";
import type { Categoria } from "@/types";

const ICONO_POR_TIPO: Record<Categoria["tipo"], LucideIcon> = {
  comer_beber: UtensilsCrossed,
  cultura: Landmark,
  naturaleza: Trees,
  tienda: ShoppingBag,
  ocio: Sparkles,
};

const MAX_CHIPS = 3;

interface Props {
  categorias: CategoriaNav[];
}

export default function Hero({ categorias }: Props) {
  const chips = categorias.slice(0, MAX_CHIPS);

  return (
    <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32 bg-tierra-50">
      
      {/* Elemento decorativo sutil (grid/noise) */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        
        {/* Tipografía gigantesca estilo editorial/SaaS moderno */}
        <div className="flex flex-col items-center text-center">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="font-sans text-xs md:text-sm font-bold tracking-[0.2em] text-terracota-600 uppercase mb-2"
          >
            Descubre la provincia
          </motion.span>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-[22vw] md:text-[200px] leading-[0.8] tracking-[-0.04em] text-oliva-900 mb-8"
          >
            Jaén.
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="max-w-xl text-base md:text-lg text-oliva-700 mb-12 md:mb-16"
          >
            Bares, restaurantes, planes y eventos ocultos. 
            Encuentra tu próxima experiencia en un solo sitio.
          </motion.p>
        </div>

        {/* Buscador ultra-premium */}
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-3xl"
        >
          <div className="rounded-[2rem] bg-white/60 backdrop-blur-xl p-2 md:p-3 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-white ring-1 ring-black/[0.03]">
            <form action="/buscar" method="get">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3 rounded-[1.5rem] bg-white/60 px-5 py-4 focus-within:bg-white transition-colors">
                  <Search size={20} strokeWidth={2} className="text-oliva-400" />
                  <label htmlFor="q" className="sr-only">
                    Buscar negocios en Jaén
                  </label>
                  <input
                    id="q"
                    name="q"
                    type="search"
                    required
                    placeholder="¿Qué te apetece hoy?"
                    className="w-full bg-transparent font-medium text-oliva-900 placeholder:text-oliva-400 outline-none"
                  />
                </div>
                <div className="hidden sm:flex items-center gap-2 px-4 py-4">
                  <MapPin size={18} strokeWidth={2} className="text-oliva-400" />
                  <span className="text-sm font-semibold text-oliva-600">Jaén</span>
                </div>
                <button
                  type="submit"
                  className="group relative overflow-hidden rounded-[1.5rem] bg-oliva-900 px-8 py-4 font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Explorar
                    <ArrowRight size={16} strokeWidth={2.5} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Chips minimalistas */}
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {chips.map((categoria) => {
              const Icono = ICONO_POR_TIPO[categoria.tipo];
              return (
                <Link
                  key={categoria.slug}
                  href={`/${categoria.slug}`}
                  className="flex items-center gap-2 rounded-full border border-oliva-100/50 bg-white/40 backdrop-blur-sm px-5 py-2.5 text-sm font-medium text-oliva-700 hover:bg-white hover:border-oliva-100 hover:text-oliva-900 hover:shadow-sm transition-all hover:-translate-y-0.5"
                >
                  {Icono && <Icono size={16} strokeWidth={2} />}
                  {categoria.nombre}
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
