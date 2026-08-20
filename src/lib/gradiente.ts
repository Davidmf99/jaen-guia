// Paleta de gradientes de respaldo mientras un negocio no tiene foto real
// subida a Supabase Storage. Se elige de forma determinista según el
// nombre, así el mismo negocio siempre muestra el mismo color (tarjetas,
// ficha de detalle, etc.).
const GRADIENTES = [
  "from-oliva-400 to-oliva-700",
  "from-terracota-400 to-terracota-600",
  "from-oliva-600 via-terracota-400 to-terracota-500",
];

export function gradientePara(nombre: string) {
  const indice =
    nombre.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    GRADIENTES.length;
  return GRADIENTES[indice];
}
