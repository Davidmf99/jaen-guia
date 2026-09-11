import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

// Sección normal. Antes envolvía su contenido en un motion.section con
// `initial={{ opacity: 0 }}` y `whileInView`, de modo que el HTML del
// servidor salía con style="opacity:0" y la sección solo se hacía
// visible cuando Motion hidrataba y un IntersectionObserver disparaba.
// Con el JS lento, caído o bloqueado, la página quedaba en blanco.
//
// Se mantiene el componente (y no se sustituye por <section> en los ocho
// sitios que lo usan) para no repetir la decisión: si algún día vuelve a
// haber animación de entrada, tiene que ser CSS y partiendo de un estado
// en reposo visible, como .animar-entrada en globals.css.
export default function AnimatedSection({ children, className }: Props) {
  return <section className={className}>{children}</section>;
}
