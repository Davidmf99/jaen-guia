"use client";

import { useState } from "react";
import { diaYMes, tintePara } from "@/lib/eventos";
import type { Categoria } from "@/types";

interface Props {
  imagen: string | null;
  fechaInicio: string;
  categoriaTipo: Categoria["tipo"] | null;
  /** La ficha necesita el número de día bastante más grande que la tarjeta. */
  tamano?: "tarjeta" | "ficha";
}

// Pensado para vivir dentro de un contenedor con position: relative (se
// coloca con inset-0), igual que ImagenNegocio.
//
// El hueco no queda vacío nunca: sin foto, o si la que hay no carga en
// el navegador, se pinta el día y el mes en grande sobre el tinte de la
// categoría. De ahí que sea componente de cliente: hace falta el onError
// para cubrir también el caso de la URL rota, que no se ve hasta que
// pasa.
export default function ImagenEvento({
  imagen,
  fechaInicio,
  categoriaTipo,
  tamano = "tarjeta",
}: Props) {
  const [fallo, setFallo] = useState(false);
  const { dia, mes } = diaYMes(fechaInicio);

  if (!imagen || fallo) {
    return (
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${tintePara(
          categoriaTipo
        )} text-white`}
      >
        <span
          className={`font-display font-semibold leading-none ${
            tamano === "ficha" ? "text-7xl md:text-8xl" : "text-5xl"
          }`}
        >
          {dia}
        </span>
        <span
          className={`mt-1.5 font-semibold tracking-[0.2em] text-white/80 ${
            tamano === "ficha" ? "text-base" : "text-sm"
          }`}
        >
          {mes}
        </span>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- URL externa de la agenda o del negocio, sin dominios fijos que declarar en next.config */
    <img
      src={imagen}
      /* alt vacío a propósito: el título del evento va justo al lado, y
         repetirlo hace que un lector de pantalla lo anuncie dos veces. */
      alt=""
      loading={tamano === "ficha" ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFallo(true)}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
