// Rellena negocios.instagram / negocios.facebook a partir de lo que ya
// tenemos: la columna `web`. Tres casos:
//   1. web ES una URL de Instagram/Facebook → se copia al campo.
//   2. web es la página propia → se descarga la portada y se buscan
//      enlaces a instagram.com / facebook.com (el típico icono del pie).
//   3. nada → se lista para rellenar a mano.
// Solo toca filas con el campo vacío. Con --escribir guarda; sin él,
// informe en seco.
//
//   npx --yes tsx --env-file=.env.local scripts/resolver-redes.mts [--escribir]
import { createClient } from "@supabase/supabase-js";

const ESCRIBIR = process.argv.includes("--escribir");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const IG = /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{1,30})\/?(?:[?#"'\s]|$)/gi;
const FB = /https?:\/\/(?:www\.|m\.)?facebook\.com\/((?:profile\.php\?id=\d+)|[A-Za-z0-9_.-]{2,})\/?(?:[?#"'\s]|$)/gi;
const IG_NO = new Set(["p", "reel", "reels", "explore", "accounts", "stories", "share", "tv", "developer", "about", "legal"]);
const FB_NO = new Set(["sharer", "share", "share.php", "dialog", "plugins", "login", "policies", "privacy", "help", "tr", "pages", "groups", "hashtag", "events", "photo.php", "watch", "story.php", "people", "public", "l.php", "business", "policy.php", "about", "legal"]);

function extraer(html: string) {
  const ig = new Set<string>();
  const fb = new Set<string>();
  for (const m of html.matchAll(IG)) if (!IG_NO.has(m[1].toLowerCase())) ig.add(m[1].toLowerCase());
  for (const m of html.matchAll(FB)) {
    const v = m[1];
    if (FB_NO.has(v.toLowerCase()) || (v.includes(".php") && !v.startsWith("profile.php"))) continue;
    fb.add(v);
  }
  return { ig: preferir([...ig]), fb: preferir([...fb]) };
}

// Una web de cadena enlaza a la cuenta de cada país; la del bar, a
// veces al diseñador. El handle con "jaen" es el local; si no, el primero.
function preferir(lista: string[]) {
  const local = lista.find((h) => h.toLowerCase().includes("jaen"));
  return local ? [local, ...lista.filter((h) => h !== local)] : lista;
}

async function portada(url: string): Promise<string | null> {
  try {
    const r = await fetch(url.startsWith("http") ? url : `https://${url}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; JaenGuia/1.0; +https://jaenguia.com)" },
    });
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type") ?? "";
    if (!tipo.includes("html")) return null;
    return (await r.text()).slice(0, 400_000);
  } catch {
    return null;
  }
}

const { data: negocios, error } = await admin
  .from("negocios")
  .select("id, nombre, slug, web, instagram, facebook, categoria:categorias(tipo)")
  .eq("activo", true)
  .not("web", "is", null)
  .order("nombre");
if (error) throw error;

type Fila = { id: string; nombre: string; slug: string; web: string; instagram: string | null; facebook: string | null };
const filas = (negocios as unknown as Fila[]).filter((n) => !n.instagram || !n.facebook);

const resultados: Array<{ nombre: string; slug: string; ig: string[]; fb: string[]; via: string }> = [];
const sinNada: string[] = [];

// Lotes de 8 para no tardar media hora ni parecer un ataque.
for (let i = 0; i < filas.length; i += 8) {
  await Promise.all(
    filas.slice(i, i + 8).map(async (n) => {
      const directo = extraer(`${n.web} `);
      if (directo.ig.length || directo.fb.length) {
        resultados.push({ nombre: n.nombre, slug: n.slug, ...directo, via: "web es la red" });
        return;
      }
      const html = await portada(n.web);
      if (!html) { sinNada.push(`${n.nombre} — ${n.web} (no carga)`); return; }
      const { ig, fb } = extraer(html);
      if (ig.length || fb.length) resultados.push({ nombre: n.nombre, slug: n.slug, ig, fb, via: "enlace en su web" });
      else sinNada.push(`${n.nombre} — ${n.web}`);
    })
  );
  process.stderr.write(`\r${Math.min(i + 8, filas.length)}/${filas.length}`);
}
process.stderr.write("\n");

console.log(`\n== ENCONTRADOS (${resultados.length}) ==`);
for (const r of resultados) console.log(`${r.nombre}  ig:${r.ig.join(",") || "-"}  fb:${r.fb.join(",") || "-"}  [${r.via}]`);
console.log(`\n== SIN RED EN SU WEB (${sinNada.length}) ==`);
for (const s of sinNada) console.log(s);

if (ESCRIBIR) {
  let n = 0;
  for (const r of resultados) {
    const fila = filas.find((f) => f.slug === r.slug)!;
    const cambio: Record<string, string> = {};
    // Si hay varios, el primero: en la portada de un bar el primer enlace
    // a Instagram es casi siempre el suyo (los otros, proveedores o el diseñador).
    if (!fila.instagram && r.ig[0]) cambio.instagram = r.ig[0];
    if (!fila.facebook && r.fb[0]) cambio.facebook = r.fb[0].startsWith("profile.php") ? `https://www.facebook.com/${r.fb[0]}` : r.fb[0];
    if (!Object.keys(cambio).length) continue;
    const { error } = await admin.from("negocios").update(cambio).eq("id", fila.id);
    if (error) console.error(`✗ ${r.nombre}: ${error.message}`);
    else n++;
  }
  console.log(`\nGuardados: ${n}`);
}
