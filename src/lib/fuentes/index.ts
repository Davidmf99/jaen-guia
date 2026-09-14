import { agendaAndalucia } from "./agenda-andalucia";
import { enjaen } from "./enjaen";
import { uja } from "./uja";
import type { Fuente } from "./tipos";

// =====================================================================
// AYUNTAMIENTO DE JAÉN: PAUSADO. NO REACTIVAR SIN AUTORIZACIÓN ESCRITA.
//
// El aviso legal de aytojaen.es
// (/portal/p_20_contenedor1.jsp?...&codAdirecto=14) dice:
//
//   "Queda prohibida su reproducción, distribución, comunicación
//    pública y transformación, salvo para uso personal y privado. Si
//    desea reutilizar nuestros contenidos de manera habitual para uso
//    público, debe contar con una autorización expresa del
//    Ayuntamiento, debiendo hacer constar su procedencia."
//
//   "Se prohíbe la reproducción total o parcial de los contenidos
//    publicados en el portal. No obstante, podrá ser objeto de
//    reproducción los contenidos que sean considerados como datos
//    abiertos en la Sede Electrónica [...]"
//
// Un cron diario que republica sus títulos y fechas en una web abierta
// ES "reutilización habitual para uso público", y su agenda cultural no
// aparece publicada como dato abierto en la Sede, así que la excepción
// no nos ampara. Que la fuente sea un RSS no cambia nada: el RSS es el
// formato de entrega, no una licencia de uso.
//
// El código del parser se conserva en ./aytojaen.ts y funciona. Para
// reactivarlo hace falta ANTES:
//   1. Autorización expresa por escrito del Ayuntamiento (OMIAC,
//      oic@aytojaen.es / 900 72 72 73).
//   2. Citar la procedencia de forma visible, como exige el aviso.
// Con las dos cosas hechas: importar `aytojaen` y añadirlo a FUENTES.
//
// Los 15 eventos que llegaron a importarse se borraron al pausarla.
// =====================================================================

// Fuentes aprobadas para la sincronización nocturna. Antes de añadir una
// nueva: comprobar su robots.txt Y su aviso legal / condiciones de uso
// (que pueden estar en una ruta que el pie enlaza en relativo, ojo),
// importar solo datos factuales (qué, cuándo, dónde) y enlazar siempre
// al original.
export const FUENTES: Fuente[] = [enjaen, agendaAndalucia, uja];

export type { EventoImportado, Fuente } from "./tipos";
