// Busca la cuenta de Instagram de los negocios que no la tienen, con el
// buscador de perfiles de Apify ("nombre + jaén"). Un resultado solo se
// da por bueno si el nombre del perfil coincide con el del negocio Y
// el perfil menciona Jaén: "lagarto jaen" devuelve a una tal Jennifer
// Lagarto, y así no entra. Lo dudoso se lista para confirmar a mano.
//
//   npx --yes tsx --env-file=.env.local scripts/buscar-instagram.mts [--escribir] [--tipo=comer_beber] [--limite=N]
import { createClient } from "@supabase/supabase-js";

const ESCRIBIR = process.argv.includes("--escribir");
const TIPO = process.argv.find((a) => a.startsWith("--tipo="))?.slice(7) ?? "comer_beber";
const LIMITE = Number(process.argv.find((a) => a.startsWith("--limite="))?.slice(9)) || 500;

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const plano = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const GENERICAS = new Set(["bar", "restaurante", "cafeteria", "cafe", "taberna", "meson", "pub", "jaen", "de", "la", "el", "los", "las", "del", "y", "en", "sl", "s.l.", "casa", "the", "and"]);
/** Palabras con peso del nombre: "Bar El Lagarto de Jaén" → ["lagarto"]. */
function claves(nombre: string) {
  return plano(nombre)
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !GENERICAS.has(p));
}

interface Perfil { username?: string; fullName?: string; biography?: string; followersCount?: number; isPrivate?: boolean; error?: string }

async function buscar(consulta: string): Promise<Perfil[]> {
  const url = new URL("https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items");
  url.searchParams.set("token", process.env.APIFY_TOKEN!);
  // Cuando la búsqueda no encuentra nada, el actor se queda colgado
  // hasta el timeout y Apify responde 400 "run-failed / TIMED-OUT". Es
  // "sin resultados", no un error, y no se cobra (pago por resultado).
  url.searchParams.set("timeout", "90");
  url.searchParams.set("format", "json");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ search: consulta, searchType: "user", searchLimit: 5, resultsType: "details", resultsLimit: 1 }),
  });
  if (res.status === 400 && /TIMED-OUT|run-failed/.test(await res.clone().text())) return [];
  if (!res.ok) throw new Error(`Apify ${res.status}`);
  return ((await res.json()) as Perfil[]).filter((p) => p.username && !p.error);
}

function puntuar(negocio: string, p: Perfil) {
  const k = claves(negocio);
  const texto = plano(`${p.username} ${p.fullName ?? ""}`).replace(/[_.]/g, " ");
  const bio = plano(p.biography ?? "");
  const coincide = k.length ? k.filter((c) => texto.includes(c)).length / k.length : 0;
  const jaen = /jaen/.test(`${texto} ${bio}`) || /\b23\d{3}\b/.test(bio);
  return { coincide, jaen, seguro: coincide >= 0.99 && jaen, posible: coincide >= 0.5 };
}

const { data: negocios, error } = await admin
  .from("negocios")
  .select("id, nombre, slug, categoria:categorias!inner(tipo)")
  .eq("activo", true)
  .eq("categorias.tipo", TIPO)
  .is("instagram", null)
  .order("nombre")
  .limit(LIMITE);
if (error) throw error;

const seguros: string[] = [];
const dudosos: string[] = [];
const nada: string[] = [];

// De 4 en 4: cada búsqueda tarda entre 20 s y 90 s.
const lista = negocios ?? [];
const procesar = async (n: (typeof lista)[number]) => {
  const k = claves(n.nombre);
  if (!k.length) { nada.push(`${n.nombre} (nombre sin palabras clave)`); return; }
  let perfiles: Perfil[] = [];
  try {
    perfiles = await buscar(`${k.join(" ")} jaen`);
  } catch (e) {
    nada.push(`${n.nombre} — ${String(e)}`);
    return;
  }
  const evaluados = perfiles.map((p) => ({ p, s: puntuar(n.nombre, p) })).sort((a, b) => b.s.coincide - a.s.coincide);
  const mejor = evaluados[0];
  if (mejor?.s.seguro) {
    seguros.push(`${n.nombre} → @${mejor.p.username}  (${mejor.p.fullName})`);
    if (ESCRIBIR) await admin.from("negocios").update({ instagram: mejor.p.username }).eq("id", n.id);
  } else if (evaluados.some((e) => e.s.posible)) {
    const cand = evaluados.filter((e) => e.s.posible).map((e) => `@${e.p.username} "${e.p.fullName}"${e.s.jaen ? " ·Jaén" : ""}`).join(" | ");
    dudosos.push(`${n.nombre} → ${cand}`);
  } else {
    nada.push(n.nombre);
  }
  process.stderr.write(".");
};
for (let i = 0; i < lista.length; i += 4) await Promise.all(lista.slice(i, i + 4).map(procesar));
process.stderr.write("\n");

console.log(`== SEGUROS (${seguros.length})${ESCRIBIR ? " · guardados" : ""}`);
seguros.forEach((s) => console.log("  " + s));
console.log(`\n== DUDOSOS, confirmar a mano (${dudosos.length})`);
dudosos.forEach((s) => console.log("  " + s));
console.log(`\n== SIN RESULTADO (${nada.length})`);
nada.forEach((s) => console.log("  " + s));
