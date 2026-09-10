// Validaciones compartidas entre el formulario (cliente) y la Server Action.
// El cliente las usa para dar feedback inmediato; el servidor las repite
// siempre, porque una Server Action se puede invocar por POST directo.

export interface CamposRegistro {
  nombre: string;
  apellidos: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  aceptaTerminos: boolean;
}

export type CampoRegistro = keyof CamposRegistro;

export type ErroresRegistro = Partial<Record<CampoRegistro | "form", string>>;

export const CAMPOS_VACIOS: CamposRegistro = {
  nombre: "",
  apellidos: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  aceptaTerminos: false,
};

// Letras (con acentos), espacios, apóstrofes y guiones. Sin dígitos.
const NOMBRE_REGEX = /^[\p{L}][\p{L}\s'’·-]*$/u;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

// Supabase (bcrypt) trunca a 72 bytes: mejor avisar que cortar en silencio.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72;

const USERNAMES_RESERVADOS = new Set([
  "admin",
  "administrador",
  "administracion",
  "root",
  "soporte",
  "ayuda",
  "contacto",
  "info",
  "api",
  "null",
  "undefined",
  "moderador",
  "staff",
  "oficial",
  "jaenguia",
  "jaen_guia",
  "jaen",
]);

const PASSWORDS_DEBILES = [
  "123456",
  "12345678",
  "1234567890",
  "password",
  "passw0rd",
  "contrasena",
  "contraseña",
  "qwerty",
  "qwertyui",
  "abc123",
  "iloveyou",
  "admin123",
  "jaen1234",
  "prueba",
  "test1234",
];

export function bytesDe(texto: string): number {
  return new TextEncoder().encode(texto).length;
}

export function normalizarUsername(valor: string): string {
  return valor.trim().toLowerCase();
}

export function normalizarEmail(valor: string): string {
  return valor.trim().toLowerCase();
}

export function validarNombre(valor: string): string | null {
  const v = valor.trim();
  if (!v) return "Escribe tu nombre.";
  if (v.length < 2) return "El nombre es demasiado corto.";
  if (v.length > 40) return "El nombre no puede pasar de 40 caracteres.";
  if (!NOMBRE_REGEX.test(v)) return "El nombre solo puede llevar letras.";
  return null;
}

export function validarApellidos(valor: string): string | null {
  const v = valor.trim();
  if (!v) return "Escribe tus apellidos.";
  if (v.length < 2) return "Los apellidos son demasiado cortos.";
  if (v.length > 60) return "Los apellidos no pueden pasar de 60 caracteres.";
  if (!NOMBRE_REGEX.test(v)) return "Los apellidos solo pueden llevar letras.";
  return null;
}

export function validarUsername(valor: string): string | null {
  const v = normalizarUsername(valor);
  if (!v) return "Elige un nombre de usuario.";
  if (v.length < 3) return "Mínimo 3 caracteres.";
  if (v.length > 20) return "Máximo 20 caracteres.";
  if (!USERNAME_REGEX.test(v)) {
    return "Solo minúsculas, números y guión bajo.";
  }
  if (v.startsWith("_") || v.endsWith("_")) {
    return "No puede empezar ni acabar con guión bajo.";
  }
  if (v.includes("__")) return "No uses dos guiones bajos seguidos.";
  if (/^\d+$/.test(v)) return "No puede ser solo números.";
  if (USERNAMES_RESERVADOS.has(v)) return "Ese nombre de usuario está reservado.";
  return null;
}

export function validarEmail(valor: string): string | null {
  const v = normalizarEmail(valor);
  if (!v) return "Escribe tu email.";
  if (v.length > 254) return "El email es demasiado largo.";
  if (!EMAIL_REGEX.test(v)) return "Formato de correo electrónico inválido.";
  return null;
}

export interface RequisitosPassword {
  longitud: boolean;
  mayuscula: boolean;
  minuscula: boolean;
  numero: boolean;
  simbolo: boolean;
}

export function requisitosPassword(password: string): RequisitosPassword {
  return {
    longitud: password.length >= PASSWORD_MIN,
    mayuscula: /[A-ZÁÉÍÓÚÜÑ]/.test(password),
    minuscula: /[a-záéíóúüñ]/.test(password),
    numero: /\d/.test(password),
    simbolo: /[^\p{L}\d]/u.test(password),
  };
}

/** Datos personales que no deberían aparecer dentro de la contraseña. */
export interface ContextoPassword {
  username?: string;
  email?: string;
  nombre?: string;
  apellidos?: string;
}

function fragmentosPersonales(contexto: ContextoPassword): string[] {
  const bruto = [
    contexto.username,
    contexto.email?.split("@")[0],
    contexto.nombre,
    contexto.apellidos,
  ];

  return bruto
    .flatMap((valor) => (valor ?? "").toLowerCase().split(/[\s._-]+/))
    .filter((fragmento) => fragmento.length >= 3);
}

export function validarPassword(
  password: string,
  contexto: ContextoPassword = {}
): string | null {
  if (!password) return "Escribe una contraseña.";
  if (password.length < PASSWORD_MIN) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  }
  if (bytesDe(password) > PASSWORD_MAX_BYTES) {
    return "La contraseña es demasiado larga (máximo 72 caracteres).";
  }
  if (password !== password.trim()) {
    return "La contraseña no puede empezar ni acabar con espacios.";
  }

  const req = requisitosPassword(password);
  if (!req.mayuscula || !req.minuscula || !req.numero) {
    return "Debe incluir una mayúscula, una minúscula y un número.";
  }

  const enMinusculas = password.toLowerCase();
  if (PASSWORDS_DEBILES.some((debil) => enMinusculas.includes(debil))) {
    return "Esa contraseña es demasiado común. Usa algo menos previsible.";
  }
  if (fragmentosPersonales(contexto).some((f) => enMinusculas.includes(f))) {
    return "La contraseña no puede contener tu nombre, usuario o email.";
  }
  if (/^(.)\1+$/.test(password)) {
    return "La contraseña no puede ser el mismo carácter repetido.";
  }

  return null;
}

export interface FuerzaPassword {
  /** 0-4 */
  puntos: number;
  etiqueta: string;
}

export function fuerzaPassword(
  password: string,
  contexto: ContextoPassword = {}
): FuerzaPassword {
  if (!password) return { puntos: 0, etiqueta: "" };

  const req = requisitosPassword(password);
  let puntos = 0;

  if (req.longitud) puntos += 1;
  if (password.length >= 12) puntos += 1;
  if (req.mayuscula && req.minuscula && req.numero) puntos += 1;
  if (req.simbolo) puntos += 1;

  // Un fallo de validación anula cualquier bonus: nunca "fuerte".
  if (validarPassword(password, contexto)) puntos = Math.min(puntos, 1);

  const etiquetas = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"];
  return { puntos, etiqueta: etiquetas[puntos] };
}

export function validarConfirmacion(
  password: string,
  confirmPassword: string
): string | null {
  if (!confirmPassword) return "Repite la contraseña.";
  if (password !== confirmPassword) return "Las contraseñas no coinciden.";
  return null;
}

/** Todas las reglas de una vez. Devuelve `{}` si el formulario es válido. */
export function validarRegistro(campos: CamposRegistro): ErroresRegistro {
  const errores: ErroresRegistro = {};

  const comprobaciones: [CampoRegistro, string | null][] = [
    ["nombre", validarNombre(campos.nombre)],
    ["apellidos", validarApellidos(campos.apellidos)],
    ["username", validarUsername(campos.username)],
    ["email", validarEmail(campos.email)],
    [
      "password",
      validarPassword(campos.password, {
        username: campos.username,
        email: campos.email,
        nombre: campos.nombre,
        apellidos: campos.apellidos,
      }),
    ],
    [
      "confirmPassword",
      validarConfirmacion(campos.password, campos.confirmPassword),
    ],
    [
      "aceptaTerminos",
      campos.aceptaTerminos ? null : "Tienes que aceptar las condiciones.",
    ],
  ];

  for (const [campo, error] of comprobaciones) {
    if (error) errores[campo] = error;
  }

  return errores;
}
