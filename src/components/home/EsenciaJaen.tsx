import Link from "next/link";
import ParallaxLayer from "@/components/motion/ParallaxLayer";
import AnimatedSection from "@/components/motion/AnimatedSection";

export default function EsenciaJaen() {
  return (
    // Fondo: sustituye el bg-gradient de ParallaxLayer por una foto real
    // de olivares (subida a /public/images/olivares.jpg o Supabase
    // Storage). Mientras tanto, un degradado de la paleta + una textura
    // de "filas de olivos" en SVG mantienen la sección con identidad
    // visual propia; ambos se mueven juntos con el parallax.
    <AnimatedSection className="relative h-72 overflow-hidden">
      <ParallaxLayer className="bg-gradient-to-br from-oliva-600 via-oliva-700 to-oliva-900">
        <svg
          className="absolute inset-0 h-full w-full opacity-20"
          preserveAspectRatio="none"
          viewBox="0 0 400 200"
          aria-hidden="true"
        >
          {Array.from({ length: 8 }).map((_, fila) => (
            <g key={fila}>
              {Array.from({ length: 12 }).map((_, col) => (
                <circle
                  key={col}
                  cx={col * 36 + (fila % 2 === 0 ? 0 : 18)}
                  cy={fila * 28 + 10}
                  r={6}
                  fill="var(--color-tierra-100)"
                />
              ))}
            </g>
          ))}
        </svg>
      </ParallaxLayer>
      <div className="absolute inset-0 bg-gradient-to-t from-oliva-900/90 via-oliva-900/40 to-transparent" />
      {/* max-w-6xl px-6 como el resto de la página: al pasar esta sección
          al final quedó pegada al footer, y su antiguo px-8 a sangre
          desalineaba el texto respecto a todo lo demás. */}
      <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-6 pb-8 text-white">
        <h2 className="font-display text-2xl font-semibold">
          La Esencia de Jaén
        </h2>
        <p className="mt-1 max-w-md text-sm text-tierra-100">
          Un paisaje patrimonio de la humanidad, cultura milenaria y vida.
          Sumérgete en el mayor olivar del mundo.
        </p>
        {/* La sección era 288px de alto sin una sola cosa que hacer.
            Ahora cierra la portada llevando a la categoría de la que
            habla, en vez de dejar al usuario en un callejón. */}
        <Link
          href="/naturaleza"
          className="mt-4 inline-block w-fit rounded-full bg-terracota-500 px-4 py-2 text-sm font-semibold text-white hover:bg-terracota-600 transition-colors"
        >
          Descubre el mar de olivos &rsaquo;
        </Link>
      </div>
    </AnimatedSection>
  );
}
