// Prueba la lectura de carteles con el proveedor configurado en .env.local
// (OPENROUTER_URL / OPENROUTER_MODELO). Útil al cambiar de modelo: si
// las fechas salen sin hora o el lugar repite el negocio, se ve aquí.
//
//   npx --yes tsx --env-file=.env.local --conditions=react-server scripts/probar-extraccion.mts cartel.png ["texto del post"]
//
// --conditions=react-server hace que `server-only` no lance fuera de Next.
import { readFileSync } from "node:fs";
import { extraerEvento } from "../src/lib/extraccion-evento";

const [ruta, texto] = process.argv.slice(2);
if (!ruta) {
  console.error("Falta la ruta de la imagen.");
  process.exit(1);
}
const mime = ruta.endsWith(".png") ? "image/png" : ruta.endsWith(".webp") ? "image/webp" : "image/jpeg";
const t0 = Date.now();
const r = await extraerEvento({ negocioNombre: "Bar de prueba", texto: texto ?? null, imagen: { bytes: readFileSync(ruta), mime } });
console.log(JSON.stringify(r, null, 2), `\n${Date.now() - t0} ms`);
