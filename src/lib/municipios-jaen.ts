// Los 97 municipios de la provincia de Jaén. Sirve para saber si un
// lugar que nombra un cartel está dentro de la provincia: un agregador
// de Jaén también publica conciertos de Granada o Córdoba, y esos no
// van en la agenda. Aquí no hay ids: la fila de `municipios` se crea
// al vuelo la primera vez que aparece, como en sync-events.

export const MUNICIPIOS_JAEN = [
  "Albanchez de Mágina", "Alcalá la Real", "Alcaudete", "Aldeaquemada", "Andújar", "Arjona", "Arjonilla", "Arquillos",
  "Arroyo del Ojanco", "Baeza", "Bailén", "Baños de la Encina", "Beas de Segura", "Bedmar y Garcíez", "Begíjar", "Bélmez de la Moraleda",
  "Benatae", "Cabra del Santo Cristo", "Cambil", "Campillo de Arenas", "Canena", "Carboneros", "Cárcheles", "La Carolina",
  "Castellar", "Castillo de Locubín", "Cazalilla", "Cazorla", "Chiclana de Segura", "Chilluévar", "Escañuela", "Espeluy",
  "Frailes", "Fuensanta de Martos", "Fuerte del Rey", "Génave", "La Guardia de Jaén", "Guarromán", "Higuera de Calatrava", "Hinojares",
  "Hornos", "Huelma", "Huesa", "Ibros", "La Iruela", "Iznatoraf", "Jabalquinto", "Jaén", "Lahiguera",
  "Jamilena", "Jimena", "Jódar", "Larva", "Linares", "Lopera", "Lupión", "Mancha Real",
  "Marmolejo", "Martos", "Mengíbar", "Montizón", "Navas de San Juan", "Noalejo", "Orcera", "Peal de Becerro",
  "Pegalajar", "Porcuna", "Pozo Alcón", "Puente de Génave", "La Puerta de Segura", "Quesada", "Rus", "Sabiote", "Santa Elena",
  "Santiago de Calatrava", "Santiago-Pontones", "Santisteban del Puerto", "Santo Tomé", "Segura de la Sierra", "Siles", "Sorihuela del Guadalimar", "Torreblascopedro",
  "Torredelcampo", "Torredonjimeno", "Torreperogil", "Torres", "Torres de Albanchez", "Úbeda", "Valdepeñas de Jaén", "Vilches",
  "Villacarrillo", "Villanueva de la Reina", "Villanueva del Arzobispo", "Villardompardo", "Los Villares", "Villarrodrigo", "Villatorres",
] as const;

export function normalizarMunicipio(nombre: string) {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CLAVES = new Map(MUNICIPIOS_JAEN.map((m) => [normalizarMunicipio(m), m]));
// "Bedmar", "Santiago Pontones", "Villares": las formas cortas que usa la gente.
const ALIAS: Record<string, string> = {
  bedmar: "Bedmar y Garcíez",
  garciez: "Bedmar y Garcíez",
  "santiago pontones": "Santiago-Pontones",
  pontones: "Santiago-Pontones",
  villares: "Los Villares",
  "la guardia": "La Guardia de Jaén",
  guardia: "La Guardia de Jaén",
  carolina: "La Carolina",
  "puerta de segura": "La Puerta de Segura",
  iruela: "La Iruela",
  "torres de albanchez": "Torres de Albanchez",
};

/** Nombre oficial si es un municipio de la provincia; null si no. "Jaén capital" → "Jaén". */
export function municipioDeJaen(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const clave = normalizarMunicipio(texto.replace(/\(jaen\)|\bjaen capital\b|\bcapital\b/gi, (m) => (/capital/i.test(m) && !/jaen/i.test(m) ? "" : m.replace(/\(|\)/g, ""))));
  if (!clave) return null;
  return CLAVES.get(clave) ?? ALIAS[clave] ?? null;
}
