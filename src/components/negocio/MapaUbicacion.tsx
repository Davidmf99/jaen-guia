"use client";

import dynamic from "next/dynamic";
import type { PuntoMapa } from "@/components/home/MapaLeaflet";

// Leaflet necesita `window`, así que el mapa se carga solo en cliente.
const MapaLeaflet = dynamic(() => import("@/components/home/MapaLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full animate-pulse rounded-2xl bg-oliva-100" />
  ),
});

interface Props {
  puntos: PuntoMapa[];
  centro: [number, number];
}

export default function MapaUbicacion({ puntos, centro }: Props) {
  return <MapaLeaflet puntos={puntos} centro={centro} zoom={15} />;
}
