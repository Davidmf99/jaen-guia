"use client";

import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// El icono por defecto de Leaflet referencia marker-icon-2x.png /
// marker-shadow.png con rutas relativas que el bundler de Next no copia
// a /public, así que dan 404 y el marcador se ve roto. Se apunta al CDN
// de unpkg en su lugar. Una sola vez, fuera del componente: este archivo
// ya se carga con { ssr: false } desde MapaExperiencia/MapaUbicacion, así
// que solo se ejecuta en cliente.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Centro aproximado de Jaén capital
export const CENTRO_JAEN: [number, number] = [37.7796, -3.7849];

export interface PuntoMapa {
  nombre: string;
  lat: number;
  lng: number;
}

interface Props {
  puntos: PuntoMapa[];
  centro?: [number, number];
  zoom?: number;
}

// Componente de mapa genérico: quien lo use decide qué puntos mostrar
// (los "imprescindibles" de la home, la ubicación de un negocio en su
// ficha...). Necesita `window`, así que siempre se carga vía
// next/dynamic con { ssr: false } desde un componente cliente.
export default function MapaLeaflet({
  puntos,
  centro = CENTRO_JAEN,
  zoom = 13,
}: Props) {
  return (
    <div className="h-80 w-full overflow-hidden rounded-2xl">
      {/* eslint-disable @typescript-eslint/no-explicit-any */}
      <MapContainer
        {...({
          center: centro,
          zoom,
          scrollWheelZoom: false,
          className: "h-full w-full",
        } as any)}
      >
        {/* Tiles CARTO "Voyager" en tonos cálidos, más acorde a la paleta
            que el Google Maps azul/gris por defecto */}
        <TileLayer
          {...({
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          } as any)}
        />
        {puntos.map((punto) => (
          <Marker key={punto.nombre} position={[punto.lat, punto.lng]}>
            <Popup>{punto.nombre}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
