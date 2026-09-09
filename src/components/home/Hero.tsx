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
  type LucideIcon,
} from "lucide-react";
import ParallaxLayer from "@/components/motion/ParallaxLayer";
import type { CategoriaNav } from "@/lib/categorias";
import type { Categoria } from "@/types";

// Los chips decían "Dónde Comer / Qué Ver / Turismo Rural", los nombres
// que tenían las categorías en 0001_init.sql y que ya no existen: la
// navegación dice "Gastronomía / Cultura / Naturaleza". Ahora salen de
// la base, así que no pueden volver a desincronizarse.
//
// El icono se mapea por `tipo` y no por categorias.icono: `tipo` es un
// CHECK fijo, mientras que icono es texto libre con el nombre de un
// componente de lucide, y resolverlo en tiempo de ejecución obligaría a
// cargar el paquete entero en el cliente.
const ICONO_POR_TIPO: Record<Categoria["tipo"], LucideIcon> = {
  comer_beber: UtensilsCrossed,
  cultura: Landmark,
  naturaleza: Trees,
  tienda: ShoppingBag,
  ocio: Sparkles,
};

// Tres, como antes: son un atajo visual, no la navegación completa.
const MAX_CHIPS = 3;

interface Props {
  categorias: CategoriaNav[];
}

export default function Hero({ categorias }: Props) {
  const chips = categorias.slice(0, MAX_CHIPS);

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

      {/* Curva orgánica que rompe la geometría del hero. Va del color de
          la sección siguiente, para leerse como que esa sección muerde el
          hero. Antes debajo iba Destacados, sobre el fondo claro de la
          página, y por eso era tierra-50; ahora debajo va la banda de
          Eventos y tiene que ser oliva-900, o queda una franja crema
          suelta entre dos zonas oscuras. */}
      <svg
        className="absolute bottom-0 left-0 w-full text-oliva-900"
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

          El z-20 mantiene la caja por encima de la sección siguiente,
          en cuya franja invade, y por debajo de la cabecera (z-50), que
          sí debe taparla al hacer scroll. Antes esa sección era
          BentoDestacados, que llevaba z-10 y ganaba por ir después en el
          DOM; ahora es la banda de Eventos.

          El -mb-10 solo a partir de sm: cancela el pt-10 de Destacados,
          así que el título "Destacados en Jaén" queda pegado al borde
          inferior de la caja, sin ningún aire. En escritorio la caja es
          de una sola fila y se ve bien; apilada en móvil (flex-col por
          debajo de sm) mide 244px y el pegado canta. */}
      <div className="relative z-20 mx-auto -mt-16 sm:-mb-10 max-w-2xl px-6">
        <div className="rounded-3xl bg-white p-3 shadow-lg">
          {/* Formulario GET nativo: así Enter en el input y el botón
              hacen exactamente lo mismo sin necesidad de un handler, y
              `required` impide navegar con el campo vacío sin depender
              de JavaScript. */}
          <form action="/buscar" method="get">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex flex-1 items-center gap-2 rounded-full border border-oliva-100 px-4 py-2.5">
                <Search size={18} aria-hidden="true" className="text-oliva-400" />
                <label htmlFor="q" className="sr-only">
                  Buscar negocios en Jaén
                </label>
                <input
                  id="q"
                  name="q"
                  type="search"
                  required
                  placeholder="¿Qué quieres descubrir?"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-oliva-400"
                />
              </div>
              <div className="flex items-center gap-2 rounded-full border border-oliva-100 px-4 py-2.5">
                <MapPin size={18} aria-hidden="true" className="text-oliva-400" />
                <span className="text-sm text-oliva-700">Jaén, España</span>
              </div>
              <button
                type="submit"
                className="rounded-full bg-terracota-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-terracota-600 transition-colors"
              >
                Buscar
              </button>
            </div>
          </form>

          {/* Fuera del form: son enlaces a una categoría, no filtros de
              la búsqueda. Dentro, además, un <button> sin type lo
              enviaría. */}
          <div className="mt-3 flex flex-wrap gap-2 px-1">
            {chips.map((categoria) => {
              const Icono = ICONO_POR_TIPO[categoria.tipo];
              return (
                <Link
                  key={categoria.slug}
                  href={`/${categoria.slug}`}
                  className="flex items-center gap-1.5 rounded-full border border-oliva-100 px-3 py-1.5 text-xs font-medium text-oliva-700 hover:border-terracota-400 hover:text-terracota-600 transition-colors"
                >
                  {Icono && <Icono size={14} aria-hidden="true" />}
                  {categoria.nombre}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
