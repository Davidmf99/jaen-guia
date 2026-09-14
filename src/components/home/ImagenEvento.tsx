"use client";

import { useState } from "react";
import { Landmark, Sparkles, ShoppingBag, Trees, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { diaYMes, tintePara } from "@/lib/eventos";
import type { Categoria } from "@/types";

// Icono de fondo del hueco sin foto, por tipo de categoría. Grande y
// casi transparente: da textura y dice de qué va sin competir con la
// fecha. Sin categoría no hay icono, solo el degradado.
const ICONO: Record<Categoria["tipo"], LucideIcon> = {
  comer_beber: UtensilsCrossed,
  cultura: Landmark,
  naturaleza: Trees,
  tienda: ShoppingBag,
  ocio: Sparkles,
};

const DIA_SEMANA = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long" });

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
    const Icono = categoriaTipo ? ICONO[categoriaTipo] : null;
    const semana = DIA_SEMANA.format(new Date(fechaInicio));
    const ficha = tamano === "ficha";
    return (
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br ${tintePara(
          categoriaTipo
        )} text-white`}
      >
        {/* Luz suave arriba a la izquierda: quita la sensación de bloque plano. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(255,255,255,0.22),transparent_55%)]"
        />
        {Icono && (
          <Icono
            aria-hidden="true"
            strokeWidth={1}
            className={`absolute -right-6 -bottom-6 text-white/10 ${ficha ? "h-72 w-72" : "h-44 w-44"}`}
          />
        )}
        <span className={`relative font-medium capitalize tracking-[0.15em] text-white/70 ${ficha ? "text-base" : "text-xs"}`}>
          {semana}
        </span>
        <span
          className={`relative font-display font-semibold leading-none ${
            ficha ? "text-7xl md:text-8xl" : "text-5xl"
          }`}
        >
          {dia}
        </span>
        <span
          className={`relative mt-1.5 font-semibold tracking-[0.2em] text-white/80 ${
            ficha ? "text-base" : "text-sm"
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
