import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { urlSitio } from "@/lib/sitio";

// Sitemap generado de la base: categorías, las 400+ fichas de negocio y
// los eventos publicados. Sin `cookies()` a propósito: con el cliente
// anónimo puro la ruta se cachea y se regenera cada hora, en vez de
// consultar Supabase en cada visita de un rastreador. La RLS ya filtra
// negocios inactivos y eventos en borrador.
export const revalidate = 3600;

const ESTATICAS: Array<{ ruta: string; prioridad: number; frecuencia: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { ruta: "/", prioridad: 1, frecuencia: "daily" },
  { ruta: "/eventos", prioridad: 0.9, frecuencia: "daily" },
  { ruta: "/destacados", prioridad: 0.7, frecuencia: "weekly" },
  { ruta: "/para-negocios", prioridad: 0.5, frecuencia: "monthly" },
  { ruta: "/contacto", prioridad: 0.3, frecuencia: "yearly" },
  { ruta: "/aviso-legal", prioridad: 0.1, frecuencia: "yearly" },
  { ruta: "/privacidad", prioridad: 0.1, frecuencia: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = urlSitio();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Eventos: los que están por venir y los del último mes (la ficha
  // sigue abierta y alguien puede llegar por un enlace compartido).
  const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [categorias, negocios, eventos] = await Promise.all([
    supabase.from("categorias").select("slug").order("orden"),
    supabase.from("negocios").select("slug, es_destacado").order("nombre"),
    supabase
      .from("eventos")
      .select("slug, actualizado_at, fecha_inicio")
      .eq("estado", "publicado")
      .gte("fecha_inicio", hace30Dias)
      .order("fecha_inicio"),
  ]);

  return [
    ...ESTATICAS.map((e) => ({
      url: `${base}${e.ruta === "/" ? "" : e.ruta}`,
      priority: e.prioridad,
      changeFrequency: e.frecuencia,
    })),
    ...(categorias.data ?? []).map((c) => ({
      url: `${base}/${c.slug}`,
      priority: 0.9,
      changeFrequency: "daily" as const,
    })),
    ...(negocios.data ?? []).map((n) => ({
      url: `${base}/negocio/${n.slug}`,
      priority: n.es_destacado ? 0.8 : 0.6,
      changeFrequency: "weekly" as const,
    })),
    ...(eventos.data ?? []).map((e) => ({
      url: `${base}/evento/${e.slug}`,
      lastModified: e.actualizado_at,
      priority: new Date(e.fecha_inicio) >= new Date() ? 0.7 : 0.3,
      changeFrequency: "weekly" as const,
    })),
  ];
}
