"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

// Fade-in + desplazamiento vertical corto al entrar en el viewport, una
// sola vez (viewport once: true — no se repite al subir/bajar). Con
// prefers-reduced-motion activado, se queda en un fade simple sin
// desplazamiento.
export default function AnimatedSection({ children, className }: Props) {
  const reducirMovimiento = useReducedMotion();

  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: reducirMovimiento ? 0 : 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: reducirMovimiento ? 0.3 : 0.4, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}
