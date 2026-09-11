"use client";

import { useEffect, useRef } from "react";

// Publica el alto real de la cabecera en --alto-cabecera, que es a lo
// que se ancla la barra de filtros sticky de las categorías.
//
// globals.css ya trae un valor de reserva en rem (calc(4.75rem + 1px))
// que escala con el tamaño de fuente del sistema y vale para el primer
// pintado y para cuando no hay JavaScript. Pero ese cálculo es una
// suma a mano del padding y del contenido, y basta con que la cabecera
// cambie —el nombre de usuario ocupa dos líneas, aparece el menú de
// escritorio, el texto está al 200%— para que se quede corto y la barra
// de filtros se meta unos píxeles por debajo.
//
// ResizeObserver lo mide en vez de suponerlo, así que no hay ninguna
// constante que mantener sincronizada con el marcado.
export default function MedidorCabecera() {
  const ancla = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const cabecera = ancla.current?.closest("header");
    if (!cabecera) return;

    // offsetHeight y no getBoundingClientRect: fuerza el recálculo de
    // maquetación, así que devuelve el alto de ahora y no el de antes
    // del cambio que ha disparado esta llamada.
    const publicar = () => {
      const alto = cabecera.offsetHeight;
      if (alto > 0) {
        document.documentElement.style.setProperty("--alto-cabecera", `${alto}px`);
      }
    };

    publicar();
    window.addEventListener("resize", publicar);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", publicar);
    }

    const observador = new ResizeObserver(publicar);
    observador.observe(cabecera);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", publicar);
    };
  }, []);

  return <span ref={ancla} aria-hidden="true" className="hidden" />;
}
