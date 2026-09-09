"use client";

import dynamic from "next/dynamic";
import type { PuntoMapa } from "./MapaLeaflet";

// Leaflet necesita `window`, así que el mapa se carga solo en cliente.
// Este envoltorio existe únicamente para poder hacer el dynamic() con
// ssr:false, que no se puede llamar desde un componente de servidor:
// así MapaExperiencia sí puede ser servidor y consultar Supabase.
const MapaLeaflet = dynamic(() => import("./MapaLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="h-80 w-full animate-pulse rounded-2xl bg-oliva-100" />
  ),
});

export default function MapaImprescindibles({ puntos }: { puntos: PuntoMapa[] }) {
  return <MapaLeaflet puntos={puntos} />;
}
