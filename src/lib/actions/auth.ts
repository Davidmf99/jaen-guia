"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { urlSitio } from "@/lib/sitio";
import type { EstadoRegistro } from "@/lib/actions/auth-estado";
import {
  normalizarEmail,
  normalizarUsername,
  validarRegistro,
  validarUsername,
  type CamposRegistro,
  type ErroresRegistro,
} from "@/lib/validaciones/registro";

/** Traduce los errores de Supabase Auth, que llegan en inglés. */
function traducirErrorSupabase(mensaje: string): ErroresRegistro {
  const m = mensaje.toLowerCase();

  if (m.includes("already registered") || m.includes("already been registered")) {
    return { email: "Ya existe una cuenta con este email." };
  }
  if (m.includes("invalid email")) {
    return { email: "Ese email no es válido." };
  }
  if (m.includes("password")) {
    return { password: "La contraseña no cumple los requisitos mínimos." };
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return { form: "Demasiados intentos. Espera unos minutos y vuelve a probar." };
  }
  if (m.includes("signups not allowed") || m.includes("disabled")) {
    return { form: "El registro está cerrado temporalmente." };
  }

  return { form: "No hemos podido crear la cuenta. Inténtalo de nuevo." };
}

/** Comprueba si un nombre de usuario está libre (para el aviso en vivo). */
export async function comprobarUsername(
  username: string
): Promise<{ disponible: boolean; error: string | null }> {
  const valor = normalizarUsername(username);
  const errorFormato = validarUsername(valor);
  if (errorFormato) return { disponible: false, error: errorFormato };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfiles")
    .select("username")
    .eq("username", valor)
    .maybeSingle();

  // Si la consulta falla no bloqueamos: el registro lo verifica igualmente.
  if (error) return { disponible: true, error: null };
  if (data) return { disponible: false, error: "Ese nombre de usuario ya está en uso." };

  return { disponible: true, error: null };
}

export async function registrarUsuario(
  _estadoPrevio: EstadoRegistro,
  formData: FormData
): Promise<EstadoRegistro> {
  const campos: CamposRegistro = {
    nombre: String(formData.get("nombre") ?? "").trim(),
    apellidos: String(formData.get("apellidos") ?? "").trim(),
    username: normalizarUsername(String(formData.get("username") ?? "")),
    email: normalizarEmail(String(formData.get("email") ?? "")),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    aceptaTerminos: formData.get("acepta_terminos") === "on",
  };
  const es_de_jaen = formData.get("es_de_jaen") === "on";

  const valores = {
    nombre: campos.nombre,
    apellidos: campos.apellidos,
    username: campos.username,
    email: campos.email,
    aceptaTerminos: campos.aceptaTerminos,
  };

  const fallar = (errores: ErroresRegistro, mensaje?: string): EstadoRegistro => ({
    errores,
    mensaje: mensaje ?? "Revisa los campos marcados.",
    exito: false,
    valores,
  });

  // Trampa para bots: campo oculto que una persona nunca rellena.
  if (String(formData.get("web") ?? "")) {
    return fallar({ form: "No hemos podido procesar el formulario." });
  }

  const errores = validarRegistro(campos);
  if (Object.keys(errores).length > 0) return fallar(errores);

  const supabase = await createClient();

  const { data: usuarioExistente } = await supabase
    .from("perfiles")
    .select("username")
    .eq("username", campos.username)
    .maybeSingle();

  if (usuarioExistente) {
    return fallar({ username: "Ese nombre de usuario ya está en uso." });
  }

  const { data, error } = await supabase.auth.signUp({
    email: campos.email,
    password: campos.password,
    options: {
      data: {
        nombre: campos.nombre,
        apellidos: campos.apellidos,
        username: campos.username,
        es_de_jaen,
      },
      // El enlace de confirmación aterriza en /auth/callback, que canjea
      // el código, manda el correo de bienvenida y lleva a la portada.
      emailRedirectTo: `${urlSitio()}/auth/callback?siguiente=%2F&bienvenida=1`,
    },
  });

  if (error) {
    return fallar(traducirErrorSupabase(error.message), error.message);
  }

  // Con confirmación por email activada, Supabase devuelve un usuario sin
  // identidades cuando el email ya existe (no filtra si está registrado).
  if (data.user && data.user.identities?.length === 0) {
    return fallar({ email: "Ya existe una cuenta con este email." });
  }

  // Sin sesión = falta confirmar el correo.
  if (!data.session) {
    return {
      errores: {},
      mensaje: `Te hemos enviado un correo a ${campos.email}. Confirma tu cuenta para empezar.`,
      exito: true,
      valores,
    };
  }

  redirect("/");
}
