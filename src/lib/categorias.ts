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
  console.log(
    "[debug categorias] NEXT_PUBLIC_SUPABASE_URL dominio:",
    (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
      } catch {
        return `no es una URL válida: "${process.env.NEXT_PUBLIC_SUPABASE_URL}"`;
      }
    })()
  );

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categorias")
    .select("slug, nombre, tipo")
    .order("orden");

  console.log("[debug categorias] data cruda:", JSON.stringify(data, null, 2));
  console.log("[debug categorias] error crudo:", JSON.stringify(error, null, 2));

  if (error || !data) return [];
  return data;
});

export async function getCategoriaPorSlug(slug: string): Promise<CategoriaNav | null> {
  const categorias = await getCategorias();
  const encontrada = categorias.find((c) => c.slug === slug) ?? null;
  console.log(`[debug categorias] getCategoriaPorSlug("${slug}") →`, JSON.stringify(encontrada));
  return encontrada;
}
