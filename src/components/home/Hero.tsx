"use client";

import { Search, MapPin, Utensils, Landmark, Trees } from "lucide-react";
import ParallaxLayer from "@/components/motion/ParallaxLayer";

const FILTROS = [
  { label: "Dónde Comer", icon: Utensils },
  { label: "Qué Ver", icon: Landmark },
  { label: "Turismo Rural", icon: Trees },
];

export default function Hero() {
  return (
    <section className="relative">
      {/*
        Imagen de fondo: sustituye el bg-gradient de ParallaxLayer por una
        foto real de Jaén (catedral, casco antiguo al atardecer) subida a
        /public/images/hero-jaen.jpg o servida desde Supabase Storage.
        Mientras tanto usamos un degradado de la propia paleta para que la
        sección nunca se vea vacía.
      */}
      <div className="relative h-[420px] w-full overflow-hidden">
        <ParallaxLayer className="bg-gradient-to-br from-oliva-700 to-oliva-900" />
        <div className="absolute inset-0 bg-gradient-to-t from-oliva-900/80 via-oliva-900/30 to-transparent" />

        <div className="relative mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-6 text-center text-white">
          <h1 className="font-display text-4xl md:text-5xl font-semibold">
            Qué hacer hoy en Jaén
          </h1>
          <p className="mt-3 text-base md:text-lg text-tierra-100">
            Bares, restaurantes, planes y eventos de toda la provincia, en un
            solo sitio.
          </p>
        </div>
      </div>

      {/* Curva orgánica que rompe la geometría del hero */}
      <svg
        className="absolute bottom-0 left-0 w-full text-tierra-50"
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M0,32 C240,80 480,0 720,24 C960,48 1200,88 1440,40 L1440,80 L0,80 Z"
        />
      </svg>

      {/* Buscador flotante: el -mt-16 ya lo monta sobre la curva; el
          -mb-10 además invade el arranque de la sección siguiente
          (Destacados), en vez de quedarse contenido dentro del propio
          hero. Por eso el section ya no lleva overflow-hidden.

          z-20 y no z-10: BentoDestacados también es z-10 y va después en
          el DOM, así que a igualdad de z-index ganaba ella y recortaba la
          parte del buscador que invade su franja. Sigue por debajo de la
          cabecera (z-50), que debe tapar el buscador al hacer scroll.

          El -mb-10 solo a partir de sm: cancela el pt-10 de Destacados,
          así que el título "Destacados en Jaén" queda pegado al borde
          inferior de la caja, sin ningún aire. En escritorio la caja es
          de una sola fila y se ve bien; apilada en móvil (flex-col por
          debajo de sm) mide 244px y el pegado canta. */}
      <div className="relative z-20 mx-auto -mt-16 sm:-mb-10 max-w-2xl px-6">
        <div className="rounded-3xl bg-white p-3 shadow-lg">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-full border border-oliva-100 px-4 py-2.5">
              <Search size={18} className="text-oliva-400" />
              <input
                type="text"
                placeholder="¿Qué quieres descubrir?"
                className="w-full bg-transparent text-sm outline-none placeholder:text-oliva-400"
              />
            </div>
            <div className="flex items-center gap-2 rounded-full border border-oliva-100 px-4 py-2.5">
              <MapPin size={18} className="text-oliva-400" />
              <span className="text-sm text-oliva-700">Jaén, España</span>
            </div>
            <button className="rounded-full bg-terracota-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-terracota-600 transition-colors">
              Buscar
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 px-1">
            {FILTROS.map(({ label, icon: Icon }) => (
              <button
                key={label}
                className="flex items-center gap-1.5 rounded-full border border-oliva-100 px-3 py-1.5 text-xs font-medium text-oliva-700 hover:border-terracota-400 hover:text-terracota-600 transition-colors"
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
