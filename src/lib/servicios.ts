import {
  Sun,
  CalendarCheck,
  ShoppingBag,
  Bike,
  Accessibility,
  Wifi,
  Dog,
  Baby,
  UtensilsCrossed,
  Leaf,
  Sprout,
  WheatOff,
  Car,
  CreditCard,
  Coffee,
  Sandwich,
  Moon,
  Martini,
  Wine,
  Users,
  type LucideIcon,
} from "lucide-react";

// Catálogo de claves de `negocios.servicios` (migración 0010). El orden
// aquí es el orden en el que se pintan en la ficha; en BD es un array
// libre, así que una clave que no esté en esta lista no se muestra.
export const SERVICIOS: ReadonlyArray<{
  clave: string;
  etiqueta: string;
  icono: LucideIcon;
}> = [
  { clave: "terraza", etiqueta: "Terraza", icono: Sun },
  { clave: "reservas", etiqueta: "Admite reservas", icono: CalendarCheck },
  { clave: "menu_dia", etiqueta: "Menú del día", icono: UtensilsCrossed },
  { clave: "desayunos", etiqueta: "Desayunos", icono: Coffee },
  { clave: "comidas", etiqueta: "Comidas", icono: Sandwich },
  { clave: "cenas", etiqueta: "Cenas", icono: Moon },
  { clave: "para_llevar", etiqueta: "Para llevar", icono: ShoppingBag },
  { clave: "a_domicilio", etiqueta: "A domicilio", icono: Bike },
  { clave: "vegetariano", etiqueta: "Opciones vegetarianas", icono: Leaf },
  { clave: "vegano", etiqueta: "Opciones veganas", icono: Sprout },
  { clave: "sin_gluten", etiqueta: "Opciones sin gluten", icono: WheatOff },
  { clave: "cocteles", etiqueta: "Cócteles", icono: Martini },
  { clave: "vino", etiqueta: "Carta de vinos", icono: Wine },
  { clave: "grupos", etiqueta: "Grupos grandes", icono: Users },
  { clave: "ninos", etiqueta: "Para ir con niños", icono: Baby },
  { clave: "mascotas", etiqueta: "Admite mascotas", icono: Dog },
  { clave: "accesible", etiqueta: "Accesible", icono: Accessibility },
  { clave: "wifi", etiqueta: "Wifi", icono: Wifi },
  { clave: "parking", etiqueta: "Parking cerca", icono: Car },
  { clave: "tarjeta", etiqueta: "Pago con tarjeta", icono: CreditCard },
];

export const RANGOS_PRECIO: ReadonlyArray<{ valor: string; etiqueta: string }> = [
  { valor: "€", etiqueta: "Económico" },
  { valor: "€€", etiqueta: "Moderado" },
  { valor: "€€€", etiqueta: "Caro" },
  { valor: "€€€€", etiqueta: "Muy caro" },
];

export function etiquetaRangoPrecio(valor: string | null | undefined) {
  return RANGOS_PRECIO.find((r) => r.valor === valor)?.etiqueta ?? null;
}

// Para inputs de texto "uno por línea o separados por comas".
export function parsearLista(valor: FormDataEntryValue | null): string[] {
  return String(valor ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
