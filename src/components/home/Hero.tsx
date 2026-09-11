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

// Componente de servidor desde que se quitó Motion. Antes era cliente
// solo por las animaciones de entrada, que servían el titular, el
// eslogan y el buscador con style="opacity:0" en el HTML: si el JS
// tardaba o fallaba, la portada se quedaba en blanco. Ahora la entrada
// es una animación CSS (.animar-entrada, en globals.css) cuyo estado en
// reposo ya es visible.
//
// El alto también se ha recortado a la mitad: el hero ocupaba una
// pantalla entera de un sitio cuyo valor es la agenda, así que en un
// móvil de 360×640 había que hacer scroll casi dos veces para llegar al
// primer evento.
export default function Hero({ categorias }: Props) {
  const chips = categorias.slice(0, MAX_CHIPS);

  return (
    <section className="animar-entrada relative overflow-hidden pt-4 pb-6 md:pt-16 md:pb-16 bg-tierra-50">
      {/* Elemento decorativo sutil (grid/noise) */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center text-center">
          {/* Oculto en móvil: es un rótulo decorativo y en una pantalla de
              640px sus 32px eran la diferencia entre ver las pestañas de
              la agenda de entrada o tener que hacer scroll. */}
          <span className="hidden sm:block font-sans text-sm md:text-base font-bold tracking-[0.15em] text-terracota-600 uppercase mb-2">
            Descubre la provincia
          </span>

          <h1 className="font-display text-[clamp(2.5rem,13vw,7.5rem)] md:text-[clamp(4rem,11vw,7.5rem)] break-words leading-[0.85] tracking-[-0.04em] text-oliva-900 mb-3">
            Jaén.
          </h1>

          <p className="max-w-xl text-base md:text-lg text-oliva-700 mb-4 md:mb-8">
            Bares, restaurantes, planes y eventos ocultos. Encuentra tu próxima
            experiencia en un solo sitio.
          </p>
        </div>

        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-[2rem] bg-white/60 backdrop-blur-xl p-2 md:p-3 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-white ring-1 ring-black/[0.03]">
            <form action="/buscar" method="get">
              <div className="flex flex-row flex-wrap items-center gap-2">
                {/* El acolchado va en el <label>, no en el <div>: así toda
                    la caja es zona de toque del campo y no solo los 24 px
                    de alto del input. */}
                <div className="flex min-w-0 flex-1 basis-48 items-center gap-3 rounded-[1.5rem] bg-white/60 focus-within:bg-white transition-colors">
                  <label
                    htmlFor="q"
                    className="flex flex-1 items-center gap-3 px-5 py-4 cursor-text"
                  >
                    <Search
                      size={22}
                      strokeWidth={2}
                      aria-hidden="true"
                      className="shrink-0 text-oliva-500"
                    />
                    <span className="sr-only">Buscar negocios en Jaén</span>
                    <input
                      id="q"
                      name="q"
                      type="search"
                      required
                      placeholder="¿Qué te apetece hoy?"
                      className="w-full bg-transparent text-base font-medium text-oliva-900 placeholder:text-oliva-500 outline-none"
                    />
                  </label>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-4 py-4">
                  <MapPin
                    size={18}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="text-oliva-500"
                  />
                  <span className="text-sm font-semibold text-oliva-600">
                    Jaén
                  </span>
                </div>
                <button
                  type="submit"
                  className="group relative grow overflow-hidden rounded-[1.5rem] bg-oliva-900 px-5 py-4 sm:grow-0 md:px-8 text-base font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Buscar
                    <ArrowRight
                      size={18}
                      strokeWidth={2.5}
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Chips de categoría: min-h-11 para que sean cómodos de tocar
              (44 px es el mínimo recomendado). */}
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            {chips.map((categoria) => {
              const Icono = ICONO_POR_TIPO[categoria.tipo];
              return (
                <Link
                  key={categoria.slug}
                  href={`/${categoria.slug}`}
                  className="flex min-h-11 items-center gap-2 rounded-full border border-oliva-100/50 bg-white/40 backdrop-blur-sm px-5 text-base font-medium text-oliva-700 hover:bg-white hover:border-oliva-100 hover:text-oliva-900 hover:shadow-sm transition-all"
                >
                  {Icono && <Icono size={18} strokeWidth={2} aria-hidden="true" />}
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
