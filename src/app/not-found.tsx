import Link from "next/link";
import { CalendarDays, Compass, Search, UtensilsCrossed } from "lucide-react";

// 404 de toda la web: URLs que no existen y fichas que ya no están
// (negocio/[slug] y evento/[slug] llaman a notFound()). Cabecera y pie
// los pone el layout; aquí solo el hueco del medio, con salidas útiles
// en vez de un "volver" a secas: quien llega por un enlace roto suele
// venir buscando un sitio o un plan.
//
// Sin `metadata`: not-found.tsx no lo admite (solo global-not-found) y
// un <title> en el cuerpo tampoco sobrevive al del layout. Se queda el
// título del sitio; Next añade el noindex por su cuenta.

const SALIDAS = [
  { href: "/eventos", icono: CalendarDays, titulo: "Qué hay estos días", texto: "La agenda de eventos de Jaén, por fecha." },
  { href: "/gastronomia", icono: UtensilsCrossed, titulo: "Dónde comer", texto: "Bares y restaurantes, con horario y si están abiertos." },
  { href: "/destacados", icono: Compass, titulo: "Lo imprescindible", texto: "Una selección para empezar por algún sitio." },
];

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col bg-tierra-50">
      <div className="mx-auto w-full max-w-4xl px-6 py-16 md:py-24">
        <p className="font-display text-7xl leading-none text-oliva-200 md:text-9xl" aria-hidden="true">
          404
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold text-oliva-900 md:text-4xl">
          Esta calle no está en el mapa
        </h1>
        <p className="mt-3 max-w-xl text-lg text-oliva-700">
          La página que buscas no existe o ya no está: puede que el sitio haya cerrado o que el enlace esté mal escrito.
        </p>

        <form action="/buscar" method="get" role="search" className="mt-8 flex max-w-xl gap-2">
          <label htmlFor="q-404" className="sr-only">
            Buscar en Jaén Guía
          </label>
          <div className="relative grow">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-oliva-500" aria-hidden="true" />
            <input
              id="q-404"
              name="q"
              type="search"
              placeholder="Busca un bar, un plan, un sitio…"
              className="w-full rounded-full border border-oliva-200 bg-white py-3 pl-11 pr-4 text-oliva-900 placeholder:text-oliva-500 focus:border-oliva-500 focus:outline-none focus:ring-2 focus:ring-oliva-200"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-oliva-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-oliva-700"
          >
            Buscar
          </button>
        </form>

        <ul className="mt-12 grid gap-4 sm:grid-cols-3">
          {SALIDAS.map(({ href, icono: Icono, titulo, texto }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full flex-col gap-2 rounded-2xl border border-oliva-100 bg-white p-5 transition-colors hover:border-oliva-400"
              >
                <Icono size={22} className="text-oliva-500" aria-hidden="true" />
                <span className="font-semibold text-oliva-900">{titulo}</span>
                <span className="text-sm text-oliva-700">{texto}</span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-sm text-oliva-700">
          ¿Has llegado desde un enlace de la propia web?{" "}
          <Link href="/contacto" className="font-semibold text-oliva-900 underline underline-offset-4">
            Dínoslo
          </Link>{" "}
          y lo arreglamos.
        </p>
      </div>
    </main>
  );
}
