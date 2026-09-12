import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con service_role: salta la RLS. Solo para lo que el cliente
// de sesión no puede hacer por diseño, como leer el email de otro
// usuario desde auth.users (avisos de /admin/solicitudes). Nunca se
// importa desde un Client Component ("server-only" lo impide en build).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
