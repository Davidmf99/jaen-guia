// Los créditos de foto vienen de authorAttributions[0].displayName de
// Google Places. Casi siempre es un nombre de persona ("Alfonso Sancho
// Rodríguez") o el perfil de empresa del propio negocio ("Restaurante
// Kasler"), pero a veces Google devuelve un aviso legal genérico en vez
// de un autor: "Photos are copyrighted by their owners". Eso no es un
// crédito y no debe pintarse como tal.
//
// El filtro es a propósito una lista de frases concretas y no una
// heurística de longitud: en los datos reales hay créditos legítimos muy
// largos ("Centro de Dinamización Turística de la Provincia de Jaén.
// Oficina de Turismo", 76 caracteres) que se perderían si se cortara por
// número de caracteres.
const FRASES_SIN_AUTOR = [
  "photos are copyrighted",
  "copyrighted by their owners",
  "all rights reserved",
  "todos los derechos reservados",
  "derechos reservados",
  "a google user",
  "google user",
  "usuario de google",
  "unknown",
  "anonymous",
  "anonimo",
];

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Devuelve el crédito ya limpio si es un autor plausible, o null si no
 * lo es. Un null significa "no pintes la etiqueta", no "pinta vacío".
 */
export function atribucionValida(bruta: string | null | undefined): string | null {
  if (!bruta) return null;

  const limpia = bruta.trim().replace(/\s+/g, " ");

  // Vacío o de una sola letra: en los datos hay valores "A" y "B", que
  // no identifican a nadie.
  if (limpia.length < 2) return null;

  // Sin ninguna letra (solo símbolos o números) no es un nombre.
  if (!/\p{L}/u.test(limpia)) return null;

  // Una URL no es un autor.
  if (/^https?:\/\//i.test(limpia)) return null;

  const normal = normalizar(limpia);
  if (FRASES_SIN_AUTOR.some((frase) => normal.includes(frase))) return null;

  return limpia;
}
