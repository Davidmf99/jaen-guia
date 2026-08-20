#!/usr/bin/env node
// =========================================================
// JAÉN GUÍA · Backfill puntual de foto de Google para negocios
// que ya existían en BD antes de que se guardara
// google_photo_name/google_photo_atribucion (migración 0005).
//
// Herramienta de un solo uso, ejecutada a mano por un dev desde
// terminal. NO forma parte de la app Next.js ni de package.json.
//
// Para cada negocio con google_photo_name = null, busca por
// "nombre, dirección" en Places API (New) Text Search y, si
// encuentra un resultado con foto, guarda su google_place_id +
// google_photo_name + google_photo_atribucion. NO descarga ni guarda
// la imagen en sí (mismas condiciones de uso que
// scripts/importar-negocios.mjs).
//
// Uso:
//   node scripts/backfill-fotos-negocios.mjs             # actualiza de verdad
//   node scripts/backfill-fotos-negocios.mjs --dry-run   # solo imprime
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

let peticionesGoogle = 0;

async function buscarPrimerLugar(textQuery) {
  peticionesGoogle++;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": ["places.id", "places.displayName", "places.photos"].join(","),
    },
    body: JSON.stringify({
      textQuery,
      languageCode: "es",
      regionCode: "ES",
    }),
  });

  if (!res.ok) {
    const texto = await res.text();
    console.error(`  ! Error Google Places (${res.status}) para "${textQuery}": ${texto}`);
    return null;
  }

  const data = await res.json();
  return data.places?.[0] ?? null;
}

async function main() {
  console.log(
    `=== Backfill de fotos de Google · negocios existentes ${DRY_RUN ? "(DRY RUN, no escribe en BD)" : ""} ===\n`
  );

  const { data: negocios, error } = await supabase
    .from("negocios")
    .select("id, nombre, direccion")
    .is("google_photo_name", null);

  if (error) throw new Error(`No se pudieron leer negocios: ${error.message}`);

  console.log(`Negocios sin foto de Google: ${negocios.length}\n`);

  let actualizados = 0;
  let sinResultado = 0;
  let sinFoto = 0;

  for (const negocio of negocios) {
    const textQuery = negocio.direccion ? `${negocio.nombre}, ${negocio.direccion}` : negocio.nombre;
    const lugar = await buscarPrimerLugar(textQuery);
    await esperar(200); // margen de cortesía frente a rate limits

    if (!lugar) {
      sinResultado++;
      console.log(`[sin resultado] ${negocio.nombre}`);
      continue;
    }

    const primeraFoto = lugar.photos?.[0];
    if (!primeraFoto) {
      sinFoto++;
      console.log(`[sin foto] ${negocio.nombre} (place_id: ${lugar.id})`);
      continue;
    }

    const cambios = {
      google_place_id: lugar.id ?? null,
      google_photo_name: primeraFoto.name,
      google_photo_atribucion: primeraFoto.authorAttributions?.[0]?.displayName ?? null,
    };

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
      continue;
    }
    actualizados++;
  }

  console.log("\n=== Resumen ===");
  console.log(`Negocios ${DRY_RUN ? "a actualizar" : "actualizados"} con foto: ${actualizados}`);
  console.log(`Sin resultado en Google Places: ${sinResultado}`);
  console.log(`Encontrados pero sin foto disponible: ${sinFoto}`);
  console.log(`Peticiones a Google Places gastadas (aprox.): ${peticionesGoogle}`);
}

main().catch((err) => {
  console.error("\nError fatal:", err.message);
  process.exit(1);
});
