"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";

interface Props {
  children?: ReactNode;
  className?: string;
  offsetPercent?: number;
}

// Capa de fondo con parallax sutil: se desplaza en translateY (nunca
// top/margin, para no forzar layout) a menos velocidad que el resto del
// contenido al hacer scroll. El wrapper exterior recorta (overflow-hidden)
// el sobre-alto de la capa interior, que mide 130% de su contenedor para
// no dejar huecos en los extremos del recorrido.
//
// `ref` se ancla al propio wrapper: useScroll mide el progreso de scroll
// de ESTE elemento cruzando el viewport, no el de la página entera, así
// que el efecto es local a la sección donde se usa.
export default function ParallaxLayer({ children, className, offsetPercent = 15 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reducirMovimiento = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reducirMovimiento ? ["0%", "0%"] : [`-${offsetPercent}%`, `${offsetPercent}%`]
  );

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <motion.div
        style={{ y, willChange: "transform" }}
        className={`absolute inset-x-0 -top-[15%] h-[130%] ${className ?? ""}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
