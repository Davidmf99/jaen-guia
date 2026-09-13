import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Categoria } from "@/types";

// Sitios sin dueño que los reclame ni horario comercial: en sus fichas
// y tarjetas no tiene sentido "abierto ahora" ni "¿es tu negocio?".
// Naturaleza entera (parques, miradores, senderos) y, en el resto de
// categorías, los tipos de Google que son monumentos o instituciones
// públicas. Un museo, un teatro o una academia sí cuentan como negocio.
const TIPOS_SIN_NEGOCIO: ReadonlySet<Categoria["tipo"]> = new Set(["naturaleza"]);
const LUGARES_SIN_DUENO: ReadonlySet<string> = new Set([
  "Lugar de interés histórico",
  "Atracción turística",
  "Escultura",
  "Castillo",
  "Iglesia",
  "Mirador",
  "Parque",
  "Zona de senderismo",
  "Centro cultural",
  "Ayuntamiento",
  "Oficina de gobierno local",
  "Centro de información turística",
  "Biblioteca",
  "Instituto de secundaria",
  "Universidad",
  "Aparcamiento",
]);

interface NegocioClasificable {
  tipo_cocina?: string[] | null;
  categoria?: { tipo: Categoria["tipo"] } | null;
}

/** Por categoría entera: decide si el listado ofrece el filtro "abierto ahora". */
export function esTipoNegocio(tipo: Categoria["tipo"] | null | undefined) {
  return tipo != null && !TIPOS_SIN_NEGOCIO.has(tipo);
}

/** Por ficha: categoría + tipos de Google del propio sitio. */
export function esNegocio({ tipo_cocina, categoria }: NegocioClasificable) {
  if (!esTipoNegocio(categoria?.tipo)) return false;
  return !(tipo_cocina ?? []).some((t) => LUGARES_SIN_DUENO.has(t));
}

// Un museo tiene horario de visita; un parque "abierto 24 horas" no
// aporta nada y queda raro.
export function muestraHorario(tipo: Categoria["tipo"] | null | undefined) {
  return tipo !== "naturaleza";
}

export interface CategoriaNav {
  slug: string;
  nombre: string;
  tipo: Categoria["tipo"];
}

// cache() deduplica la consulta entre todos los componentes que la
// pidan dentro de la misma petición (Header, generateMetadata, Page...).
export const getCategorias = cache(async (): Promise<CategoriaNav[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categorias")
    .select("slug, nombre, tipo")
    .order("orden");

  if (error || !data) return [];
  return data;
});

export async function getCategoriaPorSlug(slug: string): Promise<CategoriaNav | null> {
  const categorias = await getCategorias();
  const encontrada = categorias.find((c) => c.slug === slug) ?? null;
  return encontrada;
}
