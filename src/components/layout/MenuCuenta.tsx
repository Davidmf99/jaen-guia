"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Heart, LogOut } from "lucide-react";

interface Props {
  nombre: string;
  /** Server Action de cierre de sesión, pasada desde el Header. */
  cerrarSesion: () => Promise<void>;
}

// Menú de cuenta de la cabecera.
//
// Antes se abría solo con `group-hover` y `group-focus-within`: no había
// estado, solo CSS. En un teléfono funcionaba de rebote —el toque da
// foco al botón y focus-within se activa—, pero no había forma explícita
// de cerrarlo y nada indicaba que ese botón abriera algo.
//
// Mismo patrón que MenuMovil, que ya estaba bien resuelto: aria-expanded,
// cierre al pulsar fuera, cierre con Escape devolviendo el foco.
export default function MenuCuenta({ nombre, cerrarSesion }: Props) {
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
    <div ref={contenedor} className="relative">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="menu-cuenta"
        className="flex min-h-11 items-center gap-1.5 rounded-full border border-oliva-100 px-4 text-base font-medium text-oliva-700 hover:bg-oliva-100 transition-colors"
      >
        <span className="max-w-[10rem] truncate">{nombre}</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {/* Se renderiza siempre (solo se le pone `hidden`) para que
          aria-controls apunte a un elemento que existe de verdad. */}
      <div
        id="menu-cuenta"
        className={`absolute right-0 top-full z-10 mt-1 w-56 rounded-2xl border border-oliva-100 bg-white p-1.5 shadow-lg ${
          abierto ? "" : "hidden"
        }`}
      >
        <Link
          href="/favoritos"
          onClick={() => setAbierto(false)}
          className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-base text-oliva-700 hover:bg-oliva-50"
        >
          <Heart size={18} aria-hidden="true" className="shrink-0" />
          Mis favoritos
        </Link>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-base text-oliva-700 hover:bg-oliva-50"
          >
            <LogOut size={18} aria-hidden="true" className="shrink-0" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
