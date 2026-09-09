"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export interface EnlaceNav {
  href: string;
  label: string;
}

interface Props {
  enlaces: EnlaceNav[];
  /**
   * Solo se muestra "Iniciar sesión" dentro del menú cuando no hay
   * sesión. Con sesión iniciada, la cuenta ya vive en el desplegable de
   * la barra, que sí es visible en móvil.
   */
  mostrarLogin: boolean;
}

// Navegación para móvil: por debajo de `md` la nav de escritorio es
// `hidden md:flex` y no había ninguna alternativa, así que las
// categorías eran inalcanzables desde un teléfono.
//
// El panel se renderiza siempre (solo se le pone `hidden`) para que
// aria-controls apunte a un elemento que existe de verdad tanto abierto
// como cerrado.
export default function MenuMovil({ enlaces, mostrarLogin }: Props) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;

    // pointerdown y no click: cierra también cuando el usuario empieza a
    // arrastrar la página fuera del menú.
    function alPulsarFuera(evento: PointerEvent) {
      if (!contenedor.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    }

    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAbierto(false);
        // Devolver el foco al disparador: si no, al cerrar con Escape el
        // foco se queda en el body y se pierde el sitio del teclado.
        boton.current?.focus();
      }
    }

    document.addEventListener("pointerdown", alPulsarFuera);
    document.addEventListener("keydown", alPulsarTecla);
    return () => {
      document.removeEventListener("pointerdown", alPulsarFuera);
      document.removeEventListener("keydown", alPulsarTecla);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="md:hidden">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="menu-movil"
        aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
        className="flex items-center justify-center rounded-full border border-oliva-100 p-2 text-oliva-700 hover:bg-oliva-100 transition-colors"
      >
        {abierto ? (
          <X size={20} aria-hidden="true" />
        ) : (
          <Menu size={20} aria-hidden="true" />
        )}
      </button>

      {/* El contenedor posicionado más cercano es el <header> (sticky),
          así que top-full deja el panel justo debajo de la barra. */}
      <div
        id="menu-movil"
        className={`absolute left-0 right-0 top-full border-b border-oliva-100 bg-tierra-50 shadow-lg ${
          abierto ? "" : "hidden"
        }`}
      >
        <nav className="flex flex-col px-6 py-2">
          {enlaces.map((enlace) => (
            <Link
              key={enlace.href}
              href={enlace.href}
              onClick={() => setAbierto(false)}
              className="border-b border-oliva-100/60 py-3 text-sm font-medium text-oliva-700 last:border-b-0 hover:text-terracota-600 transition-colors"
            >
              {enlace.label}
            </Link>
          ))}

          {mostrarLogin && (
            <Link
              href="/login"
              onClick={() => setAbierto(false)}
              className="mt-3 mb-2 rounded-full border border-oliva-600 px-4 py-2 text-center text-sm font-medium text-oliva-700 hover:bg-oliva-600 hover:text-white transition-colors"
            >
              Iniciar sesión
            </Link>
          )}
        </nav>
      </div>
    </div>
  );
}
