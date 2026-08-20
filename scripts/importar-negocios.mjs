#!/usr/bin/env node
// =========================================================
// JAÉN GUÍA · Importación puntual de negocios desde Google
// Places API (New)
//
// Herramienta de un solo uso, ejecutada a mano por un dev desde
// terminal. NO forma parte de la app Next.js ni de package.json.
//
// Uso:
//   node scripts/importar-negocios.mjs                          # importa de verdad, las 5 categorías
//   node scripts/importar-negocios.mjs --dry-run                # solo imprime
//   node scripts/importar-negocios.mjs --categoria=tiendas       # limita a una categoría
//   node scripts/importar-negocios.mjs --categoria=tiendas --dry-run
//
// Requiere en .env.local: GOOGLE_PLACES_API_KEY,
// SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL.
// =========================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

// --categoria=tiendas → limita la ejecución a una sola categoría de
// CATEGORIAS_BUSQUEDA, para no re-consultar (ni gastar peticiones de)
// las que ya están importadas.
const CATEGORIA_FILTRO = process.argv
  .find((a) => a.startsWith("--categoria="))
  ?.split("=")[1];

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ---------------------------------------------------------
// Carga manual de .env.local (sin dotenv: script suelto, sin
// dependencias nuevas).
// ---------------------------------------------------------
function cargarEnvLocal() {
  const ruta = path.join(ROOT, ".env.local");
  let contenido;
  try {
    contenido = readFileSync(ruta, "utf-8");
  } catch {
    throw new Error(`No se encuentra ${ruta}. Copia .env.example y rellena las claves.`);
  }

  for (const linea of contenido.split("\n")) {
    const l = linea.trim();
    if (!l || l.startsWith("#")) continue;
    const idx = l.indexOf("=");
    if (idx === -1) continue;
    const clave = l.slice(0, idx).trim();
    let valor = l.slice(idx + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}

cargarEnvLocal();

const {
  GOOGLE_PLACES_API_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL,
} = process.env;

for (const [nombre, valor] of Object.entries({
  GOOGLE_PLACES_API_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_URL,
})) {
  if (!valor) {
    console.error(`Falta ${nombre} en .env.local`);
    process.exit(1);
  }
}

console.log(
  `[debug] SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY.length} caracteres (no vacía)`
);
try {
  console.log(`[debug] NEXT_PUBLIC_SUPABASE_URL dominio: ${new URL(NEXT_PUBLIC_SUPABASE_URL).hostname}`);
} catch {
  console.log(`[debug] NEXT_PUBLIC_SUPABASE_URL no es una URL válida: "${NEXT_PUBLIC_SUPABASE_URL}"`);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------
// Zonas y categorías a cruzar
// ---------------------------------------------------------
const ZONAS = ["Centro", "Bulevar", "Los Cerros", "La Alcantarilla", "El Valle", "Peñamefécit"];

// Centro aprox. de Jaén capital. "Jaén" es también el nombre de la
// provincia entera (20+ municipios: Cazorla, Úbeda, Linares, Martos,
// Andújar...) y aparece en TODAS sus direcciones, así que meter
// "Jaén" en el texto de búsqueda no basta ni de lejos para acotar a
// la capital — Google puede devolver resultados de cualquier sitio
// del mundo que se llame o mencione "Jaén". Este radio se usa dos
// veces: como locationRestriction (duro) en la petición a Google, y
// otra vez con Haversine sobre las coordenadas de cada resultado
// (ver distanciaMetros) porque ni el restriction de Google es
// perfectamente fiable — no confiar solo en lo que decida devolver.
//
// Excepción conocida y NO cubierta a propósito: pedanías del término
// municipal de Jaén capital como Otíñar (CP 23196), a 12-15 km del
// centro, quedan fuera de este radio. Si aparece un caso legítimo así,
// se revisa a mano — no merece la pena una heurística frágil para un
// puñado de pedanías.
const JAEN_CAPITAL = { lat: 37.7796, lng: -3.7849, radiusMetros: 8000 };

// Distancia real entre dos coordenadas (fórmula de Haversine), en
// metros. Es el único filtro geográfico del que nos fiamos del todo:
// locationRestriction ya debería descartar casi todo, pero esto es lo
// que decide qué entra en BD.
function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// locationRestriction de Places API (New) Text Search solo admite
// rectángulos, no círculos, así que aproximamos el círculo de
// JAEN_CAPITAL con su rectángulo circunscrito. Es una primera criba
// más generosa que el círculo real (para eso está el filtro
// Haversine posterior, que sí es exacto).
function rectanguloJaenCapital() {
  const { lat, lng, radiusMetros } = JAEN_CAPITAL;
  const metrosPorGradoLat = 111320;
  const metrosPorGradoLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const deltaLat = radiusMetros / metrosPorGradoLat;
  const deltaLng = radiusMetros / metrosPorGradoLng;
  return {
    low: { latitude: lat - deltaLat, longitude: lng - deltaLng },
    high: { latitude: lat + deltaLat, longitude: lng + deltaLng },
  };
}

const CATEGORIAS_BUSQUEDA = {
  gastronomia: {
    terminos: (zona) => [`restaurantes ${zona} Jaén`, `bares ${zona} Jaén`],
  },
  cultura: {
    terminos: (zona) => [
      `monumentos y museos en ${zona} Jaén`,
      `centros culturales en ${zona} Jaén`,
    ],
  },
  naturaleza: {
    terminos: (zona) => [
      `parques y zonas verdes en ${zona} Jaén`,
      `miradores y naturaleza en ${zona} Jaén`,
    ],
  },
  experiencias: {
    terminos: (zona) => [
      `planes y actividades de ocio en ${zona} Jaén`,
      `escape rooms y ocio en ${zona} Jaén`,
    ],
  },
  tiendas: {
    terminos: (zona) => [
      `tiendas de moda en ${zona} Jaén`,
      `comercios y tiendas locales en ${zona} Jaén`,
    ],
  },
};

// ---------------------------------------------------------
// Utilidades
// ---------------------------------------------------------
function normalizar(texto) {
  return (texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function generarSlugBase(nombre) {
  return normalizar(nombre)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function claveDuplicado(nombre, direccion) {
  return `${normalizar(nombre)}|${normalizar(direccion)}`;
}

// weekdayDescriptions de Google (con languageCode=es) llega ya como
// frases del tipo "lunes: 9:00–22:00" / "domingo: Cerrado". Las
// partimos en { dia: horario } para la columna jsonb `horario`.
function mapearHorario(regularOpeningHours) {
  const descripciones = regularOpeningHours?.weekdayDescriptions;
  if (!descripciones || descripciones.length === 0) return null;

  const horario = {};
  for (const linea of descripciones) {
    const idx = linea.indexOf(":");
    if (idx === -1) continue;
    const dia = linea.slice(0, idx).trim();
    const resto = linea.slice(idx + 1).trim();
    if (dia) horario[dia] = resto;
  }
  return Object.keys(horario).length > 0 ? horario : null;
}

async function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------
// Google Places API (New) — Text Search
// ---------------------------------------------------------
let peticionesGoogle = 0;

async function buscarLugares(textQuery) {
  peticionesGoogle++;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.regularOpeningHours",
        "places.types",
        "places.photos",
      ].join(","),
    },
    body: JSON.stringify({
      textQuery,
      languageCode: "es",
      regionCode: "ES",
      // locationRestriction (rectángulo) es un filtro duro en la propia
      // API, a diferencia de locationBias (que solo prioriza). Aun así,
      // el resultado se vuelve a comprobar con Haversine más abajo.
      locationRestriction: {
        rectangle: rectanguloJaenCapital(),
      },
    }),
  });

  if (!res.ok) {
    const texto = await res.text();
    console.error(`  ! Error Google Places (${res.status}) para "${textQuery}": ${texto}`);
    return [];
  }

  const data = await res.json();
  return data.places ?? [];
}

// ---------------------------------------------------------
// Categorías reales en Supabase
// ---------------------------------------------------------
async function cargarCategorias() {
  const { data, error } = await supabase.from("categorias").select("id, slug, tipo");
  console.log("[debug] categorias.select → data:", JSON.stringify(data, null, 2));
  console.log("[debug] categorias.select → error:", JSON.stringify(error, null, 2));
  if (error) throw new Error(`No se pudieron leer categorias: ${error.message}`);

  const porTipo = (tipo) => data.find((c) => c.tipo === tipo);

  const comerBeber = porTipo("comer_beber");
  const naturaleza = porTipo("naturaleza");
  const cultura = porTipo("cultura");
  const ocio = porTipo("ocio");
  const tienda = porTipo("tienda");

  if (!comerBeber) throw new Error("Falta categoria con tipo='comer_beber' (gastronomia).");
  if (!naturaleza) throw new Error("Falta categoria con tipo='naturaleza'.");
  if (!cultura) throw new Error("Falta categoria con tipo='cultura'.");
  if (!tienda) throw new Error("Falta categoria con tipo='tienda' (tiendas).");

  if (!ocio) {
    throw new Error(
      "Falta categoria con tipo='ocio' (para 'experiencias'). El script no la crea solo.\n" +
        "  Créala a mano en el SQL Editor de Supabase, por ejemplo:\n" +
        "  insert into categorias (nombre, slug, tipo, icono, orden)\n" +
        "  values ('Experiencias', 'experiencias', 'ocio', 'sparkles', 6);"
    );
  }

  return {
    gastronomia: comerBeber,
    naturaleza,
    experiencias: ocio,
    cultura,
    tiendas: tienda,
  };
}

function resolverCategoriaId(categoriaBusqueda, categorias) {
  return categorias[categoriaBusqueda].id;
}

// ---------------------------------------------------------
// Negocios existentes (para deduplicar por nombre+dirección y slugs)
// ---------------------------------------------------------
async function cargarNegociosExistentes() {
  const { data, error } = await supabase.from("negocios").select("nombre, slug, direccion");
  if (error) throw new Error(`No se pudieron leer negocios existentes: ${error.message}`);

  const claves = new Set(data.map((n) => claveDuplicado(n.nombre, n.direccion)));
  const slugs = new Set(data.map((n) => n.slug));
  return { claves, slugs };
}

function generarSlugUnico(nombre, slugsUsados) {
  const base = generarSlugBase(nombre) || "negocio";
  let slug = base;
  let sufijo = 2;
  while (slugsUsados.has(slug)) {
    slug = `${base}-${sufijo}`;
    sufijo++;
  }
  slugsUsados.add(slug);
  return slug;
}

// ---------------------------------------------------------
// Main
// ---------------------------------------------------------
async function main() {
  console.log(`=== Importación de negocios · Jaén capital ${DRY_RUN ? "(DRY RUN, no escribe en BD)" : ""} ===\n`);

  if (CATEGORIA_FILTRO && !(CATEGORIA_FILTRO in CATEGORIAS_BUSQUEDA)) {
    throw new Error(
      `--categoria=${CATEGORIA_FILTRO} no es válida. Opciones: ${Object.keys(CATEGORIAS_BUSQUEDA).join(", ")}`
    );
  }
  if (CATEGORIA_FILTRO) console.log(`Filtrando: solo categoría "${CATEGORIA_FILTRO}"\n`);

  const categorias = await cargarCategorias();
  const { claves: clavesExistentes, slugs: slugsUsados } = await cargarNegociosExistentes();

  let insertados = 0;
  let saltadosDuplicado = 0;
  let saltadosFueraCapital = 0;
  const filasParaInsertar = [];

  const entradas = CATEGORIA_FILTRO
    ? [[CATEGORIA_FILTRO, CATEGORIAS_BUSQUEDA[CATEGORIA_FILTRO]]]
    : Object.entries(CATEGORIAS_BUSQUEDA);

  for (const [categoriaBusqueda, config] of entradas) {
    for (const zona of ZONAS) {
      for (const termino of config.terminos(zona)) {
        console.log(`Buscando: "${termino}"`);
        const lugares = await buscarLugares(termino);
        await esperar(200); // margen de cortesía frente a rate limits

        const dentroDeRadio = [];
        const descartadosPorDistancia = [];
        for (const lugar of lugares) {
          const nombreLugar = lugar.displayName?.text?.trim() || "(sin nombre)";
          const lat = lugar.location?.latitude;
          const lng = lugar.location?.longitude;

          if (lat == null || lng == null) {
            descartadosPorDistancia.push(`${nombreLugar} (sin coordenadas)`);
            continue;
          }

          const distancia = distanciaMetros(JAEN_CAPITAL.lat, JAEN_CAPITAL.lng, lat, lng);
          if (distancia > JAEN_CAPITAL.radiusMetros) {
            descartadosPorDistancia.push(`${nombreLugar} (${(distancia / 1000).toFixed(1)} km)`);
            continue;
          }

          dentroDeRadio.push(lugar);
        }

        const radioKm = JAEN_CAPITAL.radiusMetros / 1000;
        console.log(
          `  ${lugares.length} resultados de Google, ${dentroDeRadio.length} pasan el filtro de ${radioKm}km` +
            (descartadosPorDistancia.length > 0
              ? `, ${descartadosPorDistancia.length} descartados: [${descartadosPorDistancia.join(", ")}]`
              : "")
        );
        saltadosFueraCapital += descartadosPorDistancia.length;

        for (const lugar of dentroDeRadio) {
          const nombre = lugar.displayName?.text?.trim();
          const direccion = lugar.formattedAddress?.trim() ?? null;
          if (!nombre) continue;

          const clave = claveDuplicado(nombre, direccion);
          if (clavesExistentes.has(clave)) {
            saltadosDuplicado++;
            continue;
          }
          clavesExistentes.add(clave); // evita duplicados dentro de la misma ejecución

          const primeraFoto = lugar.photos?.[0];

          const fila = {
            nombre,
            slug: generarSlugUnico(nombre, slugsUsados),
            categoria_id: resolverCategoriaId(categoriaBusqueda, categorias),
            zona,
            direccion,
            lat: lugar.location?.latitude ?? null,
            lng: lugar.location?.longitude ?? null,
            telefono: lugar.nationalPhoneNumber ?? lugar.internationalPhoneNumber ?? null,
            descripcion_corta: null,
            horario: mapearHorario(lugar.regularOpeningHours),
            imagen_portada: null,
            activo: true,
            google_place_id: lugar.id ?? null,
            google_photo_name: primeraFoto?.name ?? null,
            google_photo_atribucion: primeraFoto?.authorAttributions?.[0]?.displayName ?? null,
          };

          filasParaInsertar.push(fila);
        }
      }
    }
  }

  console.log(`\nNegocios nuevos encontrados: ${filasParaInsertar.length}\n`);

  if (DRY_RUN) {
    for (const fila of filasParaInsertar) {
      console.log(
        `[dry-run] ${fila.nombre} · ${fila.zona} · cat=${fila.categoria_id} · ${fila.direccion ?? "sin dirección"}`
      );
    }
    insertados = filasParaInsertar.length; // a efectos del resumen: lo que se habría insertado
  } else {
    for (const fila of filasParaInsertar) {
      const { error } = await supabase.from("negocios").insert(fila);
      if (error) {
        console.error(`  ! Error insertando "${fila.nombre}": ${error.message}`);
        continue;
      }
      insertados++;
    }
  }

  console.log("\n=== Resumen ===");
  console.log(`Negocios ${DRY_RUN ? "a insertar" : "insertados"}: ${insertados}`);
  console.log(`Saltados por duplicado (nombre+dirección ya en BD): ${saltadosDuplicado}`);
  console.log(
    `Saltados por estar a más de ${JAEN_CAPITAL.radiusMetros / 1000}km del centro de Jaén capital: ${saltadosFueraCapital}`
  );
  console.log(`Peticiones a Google Places gastadas (aprox.): ${peticionesGoogle}`);
}

main().catch((err) => {
  console.error("\nError fatal:", err.message);
  process.exit(1);
});
