interface ResenaPuntuacion {
  puntuacion: number;
}

// Compartido entre BentoDestacados, [categoria], la ficha de negocio y
// favoritos: no existe una columna puntuacion_media en negocios (ver el
// comentario en [categoria]/page.tsx), así que la nota media siempre se
// calcula aquí, a partir de las resenas ya traídas en la misma consulta.
export function calcularPuntuacionMedia(resenas: ResenaPuntuacion[]) {
  return resenas.length
    ? resenas.reduce((suma, r) => suma + r.puntuacion, 0) / resenas.length
    : undefined;
}
