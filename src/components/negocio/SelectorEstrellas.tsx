"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface Props {
  /** Nombre del campo que recibe la Server Action. */
  nombre?: string;
  inicial?: number;
}

// Selector de puntuación para el formulario de reseña.
//
// Antes era CSS puro: cinco <label>, cada uno con su radio y su propio
// `peer-checked`. Como peer-checked solo alcanza a los hermanos dentro de
// SU label, elegir 4 estrellas encendía la cuarta y dejaba apagadas la 1,
// la 2 y la 3, así que el control parecía averiado.
//
// Con estado el relleno es acumulativo de verdad, hay previsualización al
// pasar por encima y —lo que más ayuda a quien no da por hecho lo que
// significan cinco estrellas— un texto al lado que dice la nota en
// palabras. Los radios siguen siendo radios, así que el formulario envía
// igual y las flechas del teclado funcionan solas.
const PALABRA: Record<number, string> = {
  1: "Muy mala",
  2: "Mala",
  3: "Normal",
  4: "Buena",
  5: "Muy buena",
};

export default function SelectorEstrellas({
  nombre = "puntuacion",
  inicial = 5,
}: Props) {
  const [valor, setValor] = useState(inicial);
  const [previsualizada, setPrevisualizada] = useState<number | null>(null);
  const mostrada = previsualizada ?? valor;

  return (
    <fieldset className="mb-6">
      <legend className="mb-2 text-base font-semibold text-oliva-900">
        Tu puntuación
      </legend>

      <div
        className="flex flex-wrap items-center gap-1"
        onMouseLeave={() => setPrevisualizada(null)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            onMouseEnter={() => setPrevisualizada(n)}
            className="relative flex h-11 w-11 cursor-pointer items-center justify-center"
          >
            <input
              type="radio"
              name={nombre}
              value={n}
              checked={valor === n}
              onChange={() => setValor(n)}
              required
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}: ${PALABRA[n]}`}
              className="peer sr-only"
            />
            {/* El radio va sr-only, así que el contorno de foco se pinta
                sobre la estrella, que es lo que se ve. */}
            <Star
              size={30}
              aria-hidden="true"
              className={`rounded transition-colors peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-terracota-600 ${
                n <= mostrada
                  ? "fill-terracota-500 text-terracota-500"
                  : "fill-none text-oliva-400"
              }`}
            />
          </label>
        ))}

        <span
          aria-hidden="true"
          className="ml-2 text-base font-semibold text-oliva-700"
        >
          {valor} de 5 · {PALABRA[valor]}
        </span>
      </div>
    </fieldset>
  );
}
