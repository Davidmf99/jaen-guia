import Link from "next/link";
import { getCategorias } from "@/lib/categorias";

const SECCIONES = [
  { href: "/eventos", label: "Eventos" },
  { href: "/destacados", label: "Destacados" },
  { href: "/buscar", label: "Buscar" },
];

// Componente de servidor: las categorías salen de la base, igual que en
// el Header y en los chips del hero, para que no haya tres listas que
// mantener sincronizadas a mano. getCategorias() está cacheada por
// petición, así que compartirla con el Header no cuesta una consulta
// extra.
export default async function Footer() {
  const categorias = await getCategorias();
  const anio = new Date().getFullYear();

  return (
    // mt-auto lo pega abajo: el body ya era flex flex-col min-h-full.
    <footer className="mt-auto border-t border-oliva-100 bg-tierra-50">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <p className="font-display text-lg font-semibold text-oliva-900">
            Jaén Guía
          </p>
          <p className="mt-2 text-sm text-oliva-700">
            Bares, restaurantes, planes y eventos de toda la provincia de
            Jaén, en un solo sitio.
          </p>
        </div>

        <nav aria-labelledby="pie-descubre">
          <p id="pie-descubre" className="text-sm font-semibold text-oliva-900">
            Descubre
          </p>
          <ul className="mt-2 space-y-1.5">
            {categorias.map((categoria) => (
              <li key={categoria.slug}>
                <Link
                  href={`/${categoria.slug}`}
                  className="text-sm text-oliva-700 hover:text-terracota-600 transition-colors"
                >
                  {categoria.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="pie-secciones">
          <p id="pie-secciones" className="text-sm font-semibold text-oliva-900">
            Secciones
          </p>
          <ul className="mt-2 space-y-1.5">
            {SECCIONES.map((seccion) => (
              <li key={seccion.href}>
                <Link
                  href={seccion.href}
                  className="text-sm text-oliva-700 hover:text-terracota-600 transition-colors"
                >
                  {seccion.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="text-sm font-semibold text-oliva-900">Tu negocio</p>
          <p className="mt-2 text-sm text-oliva-700">
            ¿Tienes un negocio en Jaén y quieres aparecer aquí? Crea tu
            cuenta y el equipo de Jaén Guía la vincula con tu ficha.
          </p>
          <Link
            href="/registro"
            className="mt-3 inline-block rounded-full border border-oliva-600 px-4 py-1.5 text-sm font-medium text-oliva-700 hover:bg-oliva-600 hover:text-white transition-colors"
          >
            Crear cuenta
          </Link>
        </div>
      </div>

      <div className="border-t border-oliva-100">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <p className="text-xs text-oliva-600">
            &copy; {anio} Jaén Guía
          </p>
        </div>
      </div>
    </footer>
  );
}
