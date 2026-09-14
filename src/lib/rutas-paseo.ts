// Rutas a pie por Jaén para el mapa de la portada. Cada parada es el
// slug de un negocio/lugar de la guía; el orden es el del paseo real,
// comprobado con las coordenadas (de una parada a la siguiente hay
// entre 100 y 800 m). Viven en código y no en la base a propósito: son
// tres listas que cambian poco y así no hace falta una tabla ni un
// panel para editarlas. Si una parada no existe o no tiene
// coordenadas, se salta sin romper la ruta.

export interface RutaDefinida {
  clave: string;
  nombre: string;
  /** Una frase: para quién es y qué se ve. */
  descripcion: string;
  paradas: string[];
}

export const RUTAS: RutaDefinida[] = [
  {
    clave: "casco-antiguo",
    nombre: "Casco antiguo",
    descripcion: "Del castillo al Museo Íbero pasando por la catedral, los Baños Árabes y el barrio de la Magdalena.",
    paradas: [
      "castillo-de-santa-catalina",
      "cruz-del-castillo-de-santa-catalina",
      "catedral-de-la-asuncion-de-la-virgen-de-jaen",
      "basilica-de-san-ildefonso",
      "arco-de-san-lorenzo",
      "centro-cultural-banos-arabes-palacio-de-villardompardo",
      "museo-de-jaen",
      "museo-ibero",
    ],
  },
  {
    clave: "miradores",
    nombre: "Miradores",
    descripcion: "Jaén desde arriba: del cerro del castillo a la Alameda, con la campiña y Sierra Mágina de fondo.",
    paradas: [
      "cruz-del-castillo-de-santa-catalina",
      "mirador-del-tambor",
      "mirador-el-balcon-del-santo-reino",
      "mirador-de-la-ctra-circunvalacion",
      "mirador-terraza-del-centro-cultural-banos-arabes",
      "mirador-de-la-alameda",
    ],
  },
  {
    clave: "museos",
    nombre: "Museos",
    descripcion: "Los íberos, el Museo Provincial y los tres museos del Palacio de Villardompardo, todo a un paso.",
    paradas: [
      "museo-ibero",
      "museo-de-jaen",
      "museo-internacional-de-arte-naif-manuel-moral",
      "museo-de-artes-y-costumbres-populares-de-jaen",
      "museo-de-maquetas-luis-barbero",
    ],
  },
];

/** Distancia en km entre dos puntos (haversine). */
export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** "2,8 km · 45 min a pie", contando 12 min por km y 10 min por parada. */
export function resumenRuta(paradas: { lat: number; lng: number }[]) {
  let km = 0;
  for (let i = 1; i < paradas.length; i++) km += distanciaKm(paradas[i - 1], paradas[i]);
  const minutos = Math.round(km * 12 + paradas.length * 10);
  const tiempo = minutos >= 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60 ? `${minutos % 60} min` : ""}`.trim() : `${minutos} min`;
  return `${km.toFixed(1).replace(".", ",")} km · ${tiempo} a pie`;
}
