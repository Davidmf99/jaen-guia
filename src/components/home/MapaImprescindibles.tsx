"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { PuntoMapa } from "./MapaLeaflet";

// Leaflet necesita `window`, así que el mapa se carga solo en cliente.
// Este envoltorio existe únicamente para poder hacer el dynamic() con
// ssr:false, que no se puede llamar desde un componente de servidor:
// así MapaExperiencia sí puede ser servidor y consultar Supabase.
const MapaLeaflet = dynamic(() => import("./MapaLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-80 w-full animate-pulse rounded-2xl bg-oliva-100" />
  ),
});

// Margen de anticipación: se empieza a cargar antes de que el mapa
// aparezca, para que no se vea el hueco gris al llegar.
const ANTICIPACION = 400;

export default function MapaImprescindibles({ puntos, linea = false }: { puntos: PuntoMapa[]; linea?: boolean }) {
  const hueco = useRef<HTMLDivElement>(null);
  const [cerca, setCerca] = useState(false);

  // `next/dynamic` con ssr:false carga al montar, no al entrar en
  // pantalla: Leaflet, su CSS y diez teselas de OpenStreetMap se
  // descargaban en cuanto se abría la portada, aunque el mapa esté a
  // miles de píxeles de scroll.
  //
  // Se vigila por dos vías a propósito. El IntersectionObserver es la
  // buena, pero no siempre entrega (una pestaña en segundo plano o con
  // el pintado limitado puede no llamar nunca al callback), y un mapa
  // que no llega a montarse deja un rectángulo gris para siempre. La
  // comprobación por scroll es la red: mide la posición a mano, cuesta
  // muy poco y no depende de nada.
  useEffect(() => {
    const nodo = hueco.current;
    if (!nodo) return;

    let vivo = true;
    const montar = () => {
      if (!vivo) return;
      vivo = false;
      setCerca(true);
    };

    const estaCerca = () => {
      const r = nodo.getBoundingClientRect();
      return r.top - ANTICIPACION < window.innerHeight && r.bottom > -ANTICIPACION;
    };

    let pendiente = false;
    const alDesplazar = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        if (estaCerca()) montar();
      });
    };

    const observador =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entradas) => {
              if (entradas.some((e) => e.isIntersecting)) montar();
            },
            { rootMargin: `${ANTICIPACION}px` }
          )
        : null;
    observador?.observe(nodo);

    window.addEventListener("scroll", alDesplazar, { passive: true });
    window.addEventListener("resize", alDesplazar, { passive: true });
    // Por si el mapa ya se ve en la primera pantalla (ventana muy alta).
    alDesplazar();

    return () => {
      vivo = false;
      observador?.disconnect();
      window.removeEventListener("scroll", alDesplazar);
      window.removeEventListener("resize", alDesplazar);
    };
  }, []);

  return (
    <div ref={hueco} className="h-full min-h-80">
      {cerca ? (
        <MapaLeaflet puntos={puntos} linea={linea} alto="h-full" />
      ) : (
        <div
          className="h-full min-h-80 w-full rounded-2xl bg-oliva-100"
          role="status"
          aria-label="El mapa se carga al llegar a él"
        />
      )}
    </div>
  );
}
