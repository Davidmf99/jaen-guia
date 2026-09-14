import "server-only";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

// Rate limiting apoyado en Postgres (migración 0022): una función
// security definer cuenta los golpes de la ventana y decide. Aquí solo
// se la llama. Es un cortafuegos contra abuso automatizado, no un
// contador exacto: los límites son holgados para que una persona real
// no los toque nunca.

/**
 * ¿La acción está dentro del límite? Si lo está, además apunta el golpe.
 *
 * Fail-open: si el limitador falla (RPC caída, etc.) se deja pasar. Un
 * fallo del guardia nunca debe bloquear a un usuario legítimo; el resto
 * de defensas (RLS, validación) siguen en pie.
 *
 * @param actor  Identidad estable: `user:<id>` o `ip:<addr>`.
 * @param ventana Intervalo Postgres, p. ej. "10 minutes", "1 hour".
 */
export async function dentroDeLimite(
  supabase: SupabaseClient,
  actor: string,
  accion: string,
  max: number,
  ventana: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("consumir_limite", {
    p_actor: actor,
    p_accion: accion,
    p_max: max,
    p_ventana: ventana,
  });
  if (error) {
    console.error("[limite]", accion, error.message);
    return true;
  }
  return data === true;
}

/**
 * IP del cliente a partir de las cabeceras de Vercel. Para acciones sin
 * usuario logueado (registro), donde la clave del límite es la conexión.
 */
export async function ipCliente(): Promise<string> {
  const h = await headers();
  const reenviada = h.get("x-forwarded-for");
  if (reenviada) return reenviada.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "desconocida";
}
