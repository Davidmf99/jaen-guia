/**
 * Valida una ruta de vuelta antes de redirigir a ella.
 *
 * Lo que llega en `?volver=` viene de la URL, así que lo escribe quien
 * quiera. Sin esta comprobación, un enlace tipo
 * `/login?volver=https://otro-sitio` convertiría nuestra pantalla de
 * acceso en un trampolín para mandar a la gente a otra parte después de
 * escribir su contraseña.
 *
 * Se acepta solo una ruta interna: empieza por "/" y no por "//" (que el
 * navegador interpreta como otro dominio) ni por "/\".
 */
export function rutaInternaSegura(
  valor: string | undefined | null,
  porDefecto = "/"
): string {
  if (!valor) return porDefecto;
  if (!valor.startsWith("/")) return porDefecto;
  if (valor.startsWith("//") || valor.startsWith("/\\")) return porDefecto;
  return valor;
}
