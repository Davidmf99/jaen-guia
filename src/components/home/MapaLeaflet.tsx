"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

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

// Con puntero fino (ratón/trackpad) el arrastre del mapa es cómodo y no
// compite con nada. En táctil, en cambio, arrastrar sobre el mapa lo
// desplazaba a él en vez de a la página: el mapa ocupa 320px de alto y
// se convertía en una trampa de scroll. Así que el arrastre se activa
// solo en el primer caso.
const PUNTERO_FINO = "(pointer: fine)";

// Centro aproximado de Jaén capital
export const CENTRO_JAEN: [number, number] = [37.7796, -3.7849];

export interface PuntoMapa {
  nombre: string;
  lat: number;
  lng: number;
  /** Si viene, el popup del marcador enlaza a /negocio/[slug]. */
  slug?: string;
  /** Si viene, el marcador es un círculo con este número (la ruta de la portada). */
  numero?: number;
}

// Marcador numerado: el mismo número que la lista de al lado, para que
// "el 3" del mapa y "el 3" de la ruta sean lo mismo de un vistazo.
function iconoNumerado(numero: number) {
  return L.divIcon({
    className: "",
    html: `<div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-oliva-900 text-sm font-bold text-white shadow-md">${numero}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
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
  const [mapa, setMapa] = useState<L.Map | null>(null);

  // Inicializador perezoso y no useEffect: MapContainer solo lee sus
  // opciones al montarse, así que el valor tiene que ser el bueno ya en
  // el primer render. Es seguro consultar window aquí porque este
  // archivo siempre se carga con { ssr: false }.
  const [punteroFino, setPunteroFino] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia(PUNTERO_FINO).matches
  );

  useEffect(() => {
    const consulta = window.matchMedia(PUNTERO_FINO);
    const alCambiar = (evento: MediaQueryListEvent) =>
      setPunteroFino(evento.matches);
    consulta.addEventListener("change", alCambiar);
    return () => consulta.removeEventListener("change", alCambiar);
  }, []);

  // Cambiar la prop no reconfigura Leaflet (las opciones solo se leen al
  // montar), así que si el puntero cambia en caliente —un tablet al que
  // se le conecta un ratón, o el emulador de dispositivos— hay que
  // activar o desactivar el handler sobre la instancia.
  useEffect(() => {
    if (!mapa) return;
    if (punteroFino) mapa.dragging.enable();
    else mapa.dragging.disable();
  }, [mapa, punteroFino]);

  // Leaflet mide el contenedor una vez, al montar. En la portada el
  // mapa estira a la altura de la lista de al lado (h-full en una
  // rejilla), que se conoce después: sin esto se quedaba con las
  // teselas de 320 px y el resto en blanco.
  useEffect(() => {
    if (!mapa) return;
    const contenedor = mapa.getContainer();
    // Con varios puntos, encuadrarlos: el centro fijo de Jaén dejaba el
    // casco antiguo (donde están los imprescindibles) abajo del todo.
    const encuadrar = () => {
      mapa.invalidateSize();
      if (puntos.length > 1) {
        mapa.fitBounds(
          L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as [number, number])),
          { padding: [48, 48], maxZoom: 16 }
        );
      }
    };
    const observador = new ResizeObserver(encuadrar);
    observador.observe(contenedor);
    encuadrar();
    return () => observador.disconnect();
  }, [mapa, puntos]);

  return (
    <div className="h-full min-h-80 w-full overflow-hidden rounded-2xl">
      {/* eslint-disable @typescript-eslint/no-explicit-any */}
      <MapContainer
        {...({
          center: centro,
          zoom,
          scrollWheelZoom: false,
          dragging: punteroFino,
          ref: setMapa,
          className: "h-full w-full",
        } as any)}
      >
        {/* Teselas estándar de OpenStreetMap. Antes se usaba el estilo
            "Voyager" de CARTO, en tonos cálidos y más acorde a la paleta,
            pero ha pasado a exigir clave y estampaba "API KEY REQUIRED"
            sobre cada tesela. OSM no necesita clave; a cambio, el mapa
            vuelve al azul/gris estándar.
            Sin {r}: OSM no sirve teselas @2x. */}
        <TileLayer
          {...({
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            maxZoom: 19,
          } as any)}
        />
        {puntos.map((punto) => (
          <Marker
            key={punto.nombre}
            position={[punto.lat, punto.lng]}
            {...(punto.numero ? { icon: iconoNumerado(punto.numero) } : {})}
          >
            <Popup>
              {punto.slug ? (
                <Link
                  href={`/negocio/${punto.slug}`}
                  className="font-medium text-oliva-900 hover:text-terracota-600"
                >
                  {punto.nombre}
                </Link>
              ) : (
                punto.nombre
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
