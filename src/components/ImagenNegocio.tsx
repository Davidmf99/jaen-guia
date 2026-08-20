"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { gradientePara } from "@/lib/gradiente";

interface Props {
  negocioId: string;
  nombre: string;
  imagenPortada: string | null;
  googlePhotoName?: string | null;
  googlePhotoAtribucion?: string | null;
  // La ficha de negocio tiene contenido y una curva decorativa pegados
  // a la parte inferior de la imagen; ahí conviene "top-right" para no
  // quedar tapada. En las tarjetas (top-left ya lo usa la categoría/
  // puntuación) el default "bottom-right" va bien.
  posicionAtribucion?: "bottom-right" | "top-right";
}

// Pensado para vivir dentro de un contenedor con position: relative
// (se coloca con inset-0). Si hay foto de Google, se pide vía
// /api/foto-negocio/[id] (nunca se guarda la imagen, ver esa ruta);
// si la petición falla en el navegador, cae al degradado igual que
// cuando no hay ninguna imagen.
export default function ImagenNegocio({
  negocioId,
  nombre,
  imagenPortada,
  googlePhotoName,
  googlePhotoAtribucion,
  posicionAtribucion = "bottom-right",
}: Props) {
  const [fallo, setFallo] = useState(false);

  const src = googlePhotoName ? `/api/foto-negocio/${negocioId}` : imagenPortada;

  if (!src || fallo) {
    return (
      <div
        className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${gradientePara(nombre)}`}
      >
        <ImageOff size={22} aria-hidden="true" className="text-white/70" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- proxy propio, no una URL remota directa */}
      <img
        src={src}
        alt={nombre}
        onError={() => setFallo(true)}
        className="h-full w-full object-cover"
      />
      {googlePhotoName && googlePhotoAtribucion && (
        <span
          className={`absolute right-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] leading-none text-white/90 ${
            posicionAtribucion === "top-right" ? "top-1" : "bottom-1"
          }`}
        >
          Foto: {googlePhotoAtribucion}
        </span>
      )}
    </div>
  );
}
