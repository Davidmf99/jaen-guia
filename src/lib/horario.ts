// negocios.horario es { "lunes": "9:00–22:00", ... }. Los importados de
// Google llevan tilde en las claves ("miércoles", "sábado") y el panel
// las escribe sin tilde (DIAS en /panel/[slug]), así que había dos
// grafías conviviendo: la ficha no encontraba etiqueta para las
// acentuadas y el panel las mostraba vacías (y las perdía al guardar).
// Aquí se normaliza todo a claves sin tilde y en orden lunes→domingo.

export const DIAS_SEMANA = [
  { clave: "lunes", etiqueta: "Lunes" },
  { clave: "martes", etiqueta: "Martes" },
  { clave: "miercoles", etiqueta: "Miércoles" },
  { clave: "jueves", etiqueta: "Jueves" },
  { clave: "viernes", etiqueta: "Viernes" },
  { clave: "sabado", etiqueta: "Sábado" },
  { clave: "domingo", etiqueta: "Domingo" },
] as const;

export type ClaveDia = (typeof DIAS_SEMANA)[number]["clave"];

function sinTildes(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Claves sin tilde; las que no sean un día de la semana se descartan. */
export function normalizarHorario(
  horario: Record<string, string> | null | undefined
): Partial<Record<ClaveDia, string>> {
  const salida: Partial<Record<ClaveDia, string>> = {};
  if (!horario) return salida;
  for (const [clave, valor] of Object.entries(horario)) {
    const limpia = sinTildes(clave) as ClaveDia;
    if (DIAS_SEMANA.some((d) => d.clave === limpia) && valor) salida[limpia] = valor;
  }
  return salida;
}

/** [etiqueta, horas] en orden lunes→domingo, solo los días presentes. */
export function horarioOrdenado(
  horario: Record<string, string> | null | undefined
): Array<{ clave: ClaveDia; etiqueta: string; horas: string }> {
  const h = normalizarHorario(horario);
  return DIAS_SEMANA.flatMap((d) =>
    h[d.clave] ? [{ clave: d.clave, etiqueta: d.etiqueta, horas: h[d.clave]! }] : []
  );
}
