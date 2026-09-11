import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Categoria } from "@/types";

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
