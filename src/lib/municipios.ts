import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Jaén capital. Es el mismo uuid que 0001_init.sql fija como DEFAULT de
 * negocios.municipio_id y eventos.municipio_id, así que no es un valor
 * inventado aquí.
 *
 * Existe como respaldo porque `municipios` tenía RLS sin policy de
 * lectura (ver 0009_municipios_lectura_publica.sql): sin él, la consulta
 * devolvía null y el filtro de capital se caía en silencio, listando
 * eventos de toda la provincia.
 */
const MUNICIPIO_CAPITAL_ID = "a056bd1b-d6e2-40e8-b005-1d6b718854fb";

/**
 * Municipio de la capital. Esta fase del proyecto solo muestra eventos de
 * Jaén capital: los de la provincia se guardan igualmente (para cuando se
 * abra esa fase) pero no se listan.
 *
 * cache() lo deduplica dentro de la misma petición: la home lo pide una
 * vez por cada corte temporal.
 */
export const getMunicipioCapitalId = cache(async (): Promise<string> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("municipios")
    .select("id")
    .eq("es_capital", true)
    .limit(1)
    .maybeSingle();

  return data?.id ?? MUNICIPIO_CAPITAL_ID;
});
