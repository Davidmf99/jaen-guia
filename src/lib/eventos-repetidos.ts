import type { SupabaseClient } from "@supabase/supabase-js";

// La huella de la base (municipio + día + título normalizado) solo pilla
// el mismo título el mismo día. Dos fuentes que anuncian lo mismo con
// palabras distintas —"Visita cultural a Aldeaquemada" en Facebook y
// "Visita Cultural: Aldeaquemada y Santa Elena" en el RSS de la UJA—
// se le escapan. Aquí: mismo día y mismo sitio (negocio o lugar) con la
// mitad de las palabras en común, o títulos casi iguales, es repetido.
// Lo usan el buzón (redes) y sync-events (agendas).

const plano = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const palabras = (t: string) => new Set(plano(t).split(" ").filter((p) => p.length >= 4));

/**
 * La huella de la base solo pilla el mismo título el mismo día. Dos
 * posts del mismo festival con títulos distintos ("San Lucas & Roll
 * 2026" y "San Lucas & Roll 2026: M-Clan, Burning...") se le escapan:
 * mismo día, mismo sitio (negocio o lugar) y la mitad de las palabras
 * en común, es el mismo evento.
 */
export interface EventoComparable {
  titulo: string;
  /** ISO UTC. */
  fecha_inicio: string;
  negocio_id?: string | null;
  lugar_nombre?: string | null;
}

export async function pareceRepetido(admin: SupabaseClient, b: EventoComparable): Promise<boolean> {
  const dia = b.fecha_inicio.slice(0, 10);
  const { data } = await admin
    .from("eventos")
    .select("titulo, negocio_id, lugar_nombre")
    .gte("fecha_inicio", `${dia}T00:00:00Z`)
    .lt("fecha_inicio", `${dia}T23:59:59Z`)
    .neq("estado", "borrador")
    .limit(50);
  const mias = palabras(b.titulo);
  const contiene = (a: string, c: string) => a.length >= 6 && c.length >= 6 && (a.includes(c) || c.includes(a));
  return (data ?? []).some((e) => {
    const suyas = palabras(e.titulo);
    const comunes = [...mias].filter((p) => suyas.has(p)).length;
    if (!comunes) return false;
    const parecido = comunes / Math.min(mias.size, suyas.size);
    // "La Alameda" y "Auditorio Municipal La Alameda" son el mismo sitio.
    const mismoSitio =
      (b.negocio_id && e.negocio_id === b.negocio_id) ||
      (b.lugar_nombre && e.lugar_nombre && contiene(plano(e.lugar_nombre), plano(b.lugar_nombre)));
    // Mismo sitio y la mitad del título, o títulos casi iguales el mismo día.
    return (mismoSitio && parecido >= 0.5) || parecido >= 0.8;
  });
}

