import Link from "next/link";
import { Heart } from "lucide-react";
import { getCategorias } from "@/lib/categorias";

const SECCIONES = [
  { href: "/eventos", label: "Eventos" },
  { href: "/destacados", label: "Destacados" },
  { href: "/buscar", label: "Buscar" },
  { href: "/contacto", label: "Contacto" },
  { href: "/apoya", label: "Apoya Jaén Guía" },
];

const LEGAL = [
  { href: "/aviso-legal", label: "Aviso legal" },
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Condiciones de uso" },
  { href: "/cookies", label: "Cookies" },
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
          <p className="mt-2 text-base text-oliva-700">
            Bares, restaurantes, planes y eventos de toda la provincia de
            Jaén, en un solo sitio.
          </p>
        </div>

        <nav aria-labelledby="pie-descubre">
          <p id="pie-descubre" className="text-base font-semibold text-oliva-900">
            Descubre
          </p>
          <ul className="mt-1">
            {categorias.map((categoria) => (
              <li key={categoria.slug}>
                <Link
                  href={`/${categoria.slug}`}
                  className="inline-flex min-h-11 items-center text-base text-oliva-700 hover:text-terracota-600 transition-colors"
                >
                  {categoria.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="pie-secciones">
          <p id="pie-secciones" className="text-base font-semibold text-oliva-900">
            Secciones
          </p>
          <ul className="mt-1">
            {SECCIONES.map((seccion) => (
              <li key={seccion.href}>
                <Link
                  href={seccion.href}
                  className="inline-flex min-h-11 items-center text-base text-oliva-700 hover:text-terracota-600 transition-colors"
                >
                  {seccion.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="text-base font-semibold text-oliva-900">Tu negocio</p>
          <p className="mt-2 text-base text-oliva-700">
            ¿Tienes un bar, tienda o local en Jaén? Seguramente ya tiene
            ficha: reclámala gratis y gestiónala tú.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/para-negocios"
              className="inline-flex min-h-11 items-center rounded-full border border-oliva-600 px-5 text-base font-medium text-oliva-700 hover:bg-oliva-600 hover:text-white transition-colors"
            >
              Reclamar mi negocio
            </Link>
            <Link
              href="/contacto"
              className="inline-flex min-h-11 items-center rounded-full bg-terracota-600 px-5 text-base font-medium text-white hover:bg-terracota-700 transition-colors"
            >
              Contacto
            </Link>
          </div>
          {/* La web la hace una persona y no lleva anuncios: el apoyo se
              pide aquí, al lado de lo del negocio, sin convertirlo en
              banner. */}
          <p className="mt-5 text-base text-oliva-700">Sin anuncios. Si la web te sirve, puedes echar una mano.</p>
          <Link
            href="/apoya"
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-terracota-500/60 px-5 text-base font-medium text-terracota-600 transition-colors hover:bg-terracota-500/10"
          >
            <Heart size={16} aria-hidden="true" /> Apoya Jaén Guía
          </Link>
        </div>
      </div>

      <div className="border-t border-oliva-100">
        <div className="mx-auto flex flex-col md:flex-row items-center justify-between gap-4 max-w-6xl px-6 py-4">
          <p className="text-sm text-oliva-600">
            &copy; {anio} Jaén Guía
          </p>
          <ul className="flex items-center gap-4 text-sm text-oliva-600">
            {LEGAL.map((enlace) => (
              <li key={enlace.href}>
                <Link href={enlace.href} className="inline-flex min-h-11 items-center hover:text-oliva-900 transition-colors">
                  {enlace.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
