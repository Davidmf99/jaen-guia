"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

// Contenedor que dispara "visible" para sus tarjetas (ver NegocioCard)
// al entrar en el viewport, una sola vez. La propagación de variants de
// Framer Motion atraviesa los <div> normales que pueda haber entre este
// contenedor y cada tarjeta, así que no hace falta que el grid sea
// plano — un grid con sub-grids anidados (como el bento de
// BentoDestacados) también funciona.
//
// El escalonado en sí NO se hace aquí con `staggerChildren`: ese
// mecanismo de Framer Motion multiplica el delay por la posición de
// cada hijo sin límite, así que en un listado grande (p. ej.
// /gastronomia con 20+ negocios) las últimas tarjetas tardaban varios
// segundos en aparecer. El delay, ya con tope, lo calcula cada
// NegocioCard a partir de su propio `index`; aquí se deja a 0 (sin
// efecto), solo para mantener el mismo objeto de variants que ya
// estaba probado funcionando.
export default function GridStagger({ children, className }: Props) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0 } } }}
    >
      {children}
    </motion.div>
  );
}
