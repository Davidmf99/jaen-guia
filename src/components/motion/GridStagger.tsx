import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

// Contenedor de rejilla. Antes era el motion.div que llevaba las
// tarjetas de "hidden" a "visible" al entrar en el viewport: mientras no
// disparara, cada tarjeta se servía con style="opacity:0" desde el
// servidor, así que sin JavaScript no había listados que ver.
//
// El escalonado de entrada se ha retirado entero, aquí y en las
// tarjetas. Para quien entra a mirar si hay algo esta tarde, ver la lista
// ya montada vale más que verla montarse.
export default function GridStagger({ children, className }: Props) {
  return <div className={className}>{children}</div>;
}
