#!/usr/bin/env node
// =========================================================
// JAÉN GUÍA · Backfill de detalles (migración 0010) desde Google
// Places para negocios que ya tienen google_place_id.
//
// Herramienta de un solo uso, ejecutada a mano por un dev desde
// terminal. NO forma parte de la app Next.js ni de package.json.
//
// Para cada negocio con google_place_id, pide Place Details y
// rellena SOLO lo que esté vacío en BD (no pisa lo que haya escrito
// el dueño desde el panel):
//   priceLevel                → rango_precio
//   editorialSummary          → descripcion (si está vacía)
//   websiteUri                → web (si está vacía)
//   booleanos de atmósfera    → servicios (terraza, reservas, ...)
//   primaryTypeDisplayName    → tipo_cocina (si está vacío)
//
// OJO con el coste: estos campos entran en los SKU "Place Details
// (Enterprise + Atmosphere)", más caros que el Text Search básico.
// Con --dry-run se hacen las mismas peticiones pero no se escribe.
//
// Uso:
//   node scripts/backfill-detalles-negocios.mjs             # actualiza
//   node scripts/backfill-detalles-negocios.mjs --dry-run   # solo imprime
//
// Requiere en .env.local: GOOGLE_PLACES_API_KEY,
// SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL.
// =========================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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

const { GOOGLE_PLACES_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL } = process.env;

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

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Mismos valores que el CHECK de negocios.rango_precio.
const RANGO_PRECIO = {
  PRICE_LEVEL_INEXPENSIVE: "€",
  PRICE_LEVEL_MODERATE: "€€",
  PRICE_LEVEL_EXPENSIVE: "€€€",
  PRICE_LEVEL_VERY_EXPENSIVE: "€€€€",
};

// Campo de Google → clave de src/lib/servicios.ts.
const SERVICIOS_GOOGLE = {
  outdoorSeating: "terraza",
  reservable: "reservas",
  takeout: "para_llevar",
  delivery: "a_domicilio",
  servesVegetarianFood: "vegetariano",
  servesCocktails: "cocteles",
  servesWine: "vino",
  goodForGroups: "grupos",
  goodForChildren: "ninos",
  allowsDogs: "mascotas",
  servesBreakfast: "desayunos",
  servesLunch: "comidas",
  servesDinner: "cenas",
};

const FIELD_MASK = [
  "id",
  "priceLevel",
  "editorialSummary",
  "websiteUri",
  "primaryTypeDisplayName",
  "accessibilityOptions",
  "paymentOptions",
  "parkingOptions",
  ...Object.keys(SERVICIOS_GOOGLE),
].join(",");

// primaryTypeDisplayName demasiado vagos como para pintarlos en un chip.
const TIPOS_GENERICOS = new Set(["Comercio", "Servicios", "Oficinas de empresa", "Establecimiento"]);

let peticionesGoogle = 0;

async function detallesLugar(placeId) {
  peticionesGoogle++;
  // google_place_id puede venir como "places/XXX" o como "XXX" a secas.
  const id = placeId.replace(/^places\//, "");
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=es&regionCode=ES`, {
    headers: {
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": FIELD_MASK,
    },
  });

  if (!res.ok) {
    const texto = await res.text();
    console.error(`  ! Error Google Places (${res.status}) para ${placeId}: ${texto}`);
    return null;
  }

  return res.json();
}

function serviciosDesde(lugar) {
  const claves = [];
  for (const [campo, clave] of Object.entries(SERVICIOS_GOOGLE)) {
    if (lugar[campo] === true) claves.push(clave);
  }
  if (lugar.accessibilityOptions?.wheelchairAccessibleEntrance === true) claves.push("accesible");
  if (lugar.paymentOptions?.acceptsCreditCards === true) claves.push("tarjeta");
  const parking = lugar.parkingOptions ?? {};
  if (Object.values(parking).some((v) => v === true)) claves.push("parking");
  return claves;
}

async function main() {
  console.log(
    `=== Backfill de detalles desde Google Places ${DRY_RUN ? "(DRY RUN, no escribe en BD)" : ""} ===\n`
  );

  const { data: negocios, error } = await supabase
    .from("negocios")
    .select("id, nombre, google_place_id, descripcion, web, rango_precio, tipo_cocina, servicios")
    .not("google_place_id", "is", null);

  if (error) throw new Error(`No se pudieron leer negocios: ${error.message}`);

  console.log(`Negocios con google_place_id: ${negocios.length}\n`);

  let actualizados = 0;
  let sinCambios = 0;
  let fallidos = 0;

  for (const negocio of negocios) {
    const lugar = await detallesLugar(negocio.google_place_id);
    await esperar(200); // margen de cortesía frente a rate limits

    if (!lugar) {
      fallidos++;
      continue;
    }

    const cambios = {};

    if (!negocio.rango_precio && RANGO_PRECIO[lugar.priceLevel]) {
      cambios.rango_precio = RANGO_PRECIO[lugar.priceLevel];
    }
    if (!negocio.descripcion && lugar.editorialSummary?.text) {
      cambios.descripcion = lugar.editorialSummary.text;
    }
    if (!negocio.web && lugar.websiteUri) {
      cambios.web = lugar.websiteUri;
    }
    const tipo = lugar.primaryTypeDisplayName?.text;
    if ((negocio.tipo_cocina ?? []).length === 0 && tipo && !TIPOS_GENERICOS.has(tipo)) {
      cambios.tipo_cocina = [tipo];
    }
    if ((negocio.servicios ?? []).length === 0) {
      const servicios = serviciosDesde(lugar);
      if (servicios.length > 0) cambios.servicios = servicios;
    }

    if (Object.keys(cambios).length === 0) {
      sinCambios++;
      console.log(`[sin cambios] ${negocio.nombre}`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${negocio.nombre} → ${JSON.stringify(cambios)}`);
      actualizados++;
      continue;
    }

    const { error: errorUpdate } = await supabase
      .from("negocios")
      .update(cambios)
      .eq("id", negocio.id);

    if (errorUpdate) {
      console.error(`  ! Error actualizando "${negocio.nombre}": ${errorUpdate.message}`);
      fallidos++;
      continue;
    }
    console.log(`[ok] ${negocio.nombre} → ${Object.keys(cambios).join(", ")}`);
    actualizados++;
  }

  console.log("\n=== Resumen ===");
  console.log(`Negocios ${DRY_RUN ? "a actualizar" : "actualizados"}: ${actualizados}`);
  console.log(`Sin nada nuevo que rellenar: ${sinCambios}`);
  console.log(`Fallidos: ${fallidos}`);
  console.log(`Peticiones a Google Places gastadas (aprox.): ${peticionesGoogle}`);
}

main().catch((err) => {
  console.error("\nError fatal:", err.message);
  process.exit(1);
});
