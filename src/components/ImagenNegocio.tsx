"use client";

import { useState } from "react";
import Image from "next/image";
import { gradientePara } from "@/lib/gradiente";
import { atribucionValida } from "@/lib/atribucion";

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
  /**
   * Solo la foto grande de la ficha de negocio, que es lo primero que se
   * ve. El resto va en diferido: en la portada había tres fotos de
   * 332, 169 y 128 KB descargándose de golpe para tarjetas de 160px.
   */
  prioritaria?: boolean;
}

// Iniciales del negocio para el hueco sin foto. Antes se pintaba un
// icono de "imagen rota", que se lee como "esta web está mal", no como
// "este sitio no tiene foto".
function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
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
  prioritaria = false,
}: Props) {
  const [fallo, setFallo] = useState(false);

  const base = imagenPortada ? imagenPortada : googlePhotoName ? `/api/foto-negocio/${negocioId}` : null;
  // Google a veces manda un aviso legal en lugar de un autor; en ese
  // caso esto es null y la etiqueta no se pinta (ver lib/atribucion.ts).
  const atribucion = atribucionValida(googlePhotoAtribucion);

  if (!base || fallo) {
    return (
      <div
        className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${gradientePara(nombre)}`}
      >
        <span
          aria-hidden="true"
          className="font-display text-4xl font-semibold text-white/90"
        >
          {iniciales(nombre)}
        </span>
      </div>
    );
  }

  // Solo el proxy propio sabe servir varios anchos; una URL de portada
  // subida al panel es un fichero suelto y se sirve tal cual.
  const srcSet = googlePhotoName
    ? `${base}?w=400 400w, ${base}?w=800 800w, ${base}?w=1200 1200w`
    : undefined;

  return (
    <div className="absolute inset-0">
      <Image
        src={base}
        alt=""
        fill
        sizes={prioritaria ? "(min-width: 768px) 1100px, 100vw" : "(min-width: 768px) 380px, 92vw"}
        priority={prioritaria}
        onError={() => setFallo(true)}
        className="object-cover"
        unoptimized={!googlePhotoName && base.startsWith('http')}
      />
      {(!imagenPortada && googlePhotoName && atribucion) && (
        <span
          className={`absolute right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs leading-tight text-white ${
            posicionAtribucion === "top-right" ? "top-1" : "bottom-1"
          }`}
        >
          Foto: {atribucion}
        </span>
      )}
    </div>
  );
}
