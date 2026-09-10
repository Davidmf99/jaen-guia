"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Spinner from "@/components/ui/Spinner";

// Tope de seguridad: si la navegación se cancela (el usuario vuelve atrás,
// el destino falla…) la barra se retira sola en vez de quedarse colgada.
const MAX_MS = 12_000;

// Las rutas prefetcheadas cargan al instante: sin esta espera la barra
// aparecería y desaparecería en un fotograma, que se ve peor que nada.
const RETARDO_MS = 150;

/**
 * Barra de progreso global para las navegaciones entre rutas.
 *
 * No hay un evento "navegación en curso" en el App Router, así que se
 * escucha el clic sobre enlaces internos (captura, para enterarnos antes
 * que `next/link`) y se retira la barra cuando la ruta ya ha cambiado.
 * Sirve igual para `<Link>` que para un `<a href>` suelto.
 */
export default function BarraProgreso() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rutaActual = `${pathname}?${searchParams.toString()}`;

  // Ruta desde la que se lanzó la navegación. Mientras siga siendo la ruta
  // visible, la navegación no ha terminado.
  const [rutaOrigen, setRutaOrigen] = useState<string | null>(null);
  const navegando = rutaOrigen !== null && rutaOrigen === rutaActual;

  // Ruta cuya navegación ya ha tardado lo suficiente como para avisar.
  const [rutaLenta, setRutaLenta] = useState<string | null>(null);
  const visible = navegando && rutaLenta === rutaOrigen;

  useEffect(() => {
    function alHacerClic(evento: MouseEvent) {
      if (
        evento.defaultPrevented ||
        evento.button !== 0 ||
        evento.metaKey ||
        evento.ctrlKey ||
        evento.shiftKey ||
        evento.altKey
      ) {
        return;
      }

      const enlace = (evento.target as HTMLElement | null)?.closest?.("a");
      if (!enlace || !enlace.href) return;
      if (enlace.target && enlace.target !== "_self") return;
      if (enlace.hasAttribute("download")) return;

      const destino = new URL(enlace.href, window.location.href);
      if (destino.origin !== window.location.origin) return;
      // Misma URL o simple ancla dentro de la página: no hay carga que mostrar.
      if (
        destino.pathname === window.location.pathname &&
        destino.search === window.location.search
      ) {
        return;
      }

      setRutaOrigen(rutaActual);
    }

    document.addEventListener("click", alHacerClic, true);
    return () => document.removeEventListener("click", alHacerClic, true);
  }, [rutaActual]);

  useEffect(() => {
    if (!navegando) return;

    const aparicion = setTimeout(() => setRutaLenta(rutaOrigen), RETARDO_MS);
    const rendicion = setTimeout(() => setRutaOrigen(null), MAX_MS);

    return () => {
      clearTimeout(aparicion);
      clearTimeout(rendicion);
    };
  }, [navegando, rutaOrigen]);

  if (!visible) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-[100] h-[3px] bg-terracota-500/15"
      >
        <div className="animar-barra-progreso h-full w-full bg-gradient-to-r from-terracota-500 to-terracota-400 shadow-[0_0_10px_rgba(201,111,58,0.6)]" />
      </div>
      <div className="fixed bottom-5 right-5 z-[100] rounded-full bg-white/90 p-2.5 shadow-lg backdrop-blur-sm">
        <Spinner size={20} etiqueta="Cargando página" />
      </div>
    </>
  );
}
