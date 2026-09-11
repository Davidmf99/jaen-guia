"use client";

import { useState, type ChangeEvent } from "react";

interface Props {
  imagenActual: string | null;
}

// Lado largo máximo y calidad JPEG de la portada. 1800 px sobra para el
// hero de la ficha (450 px de alto en escritorio, pantallas 2x incluidas)
// y deja una foto de móvil de 5–8 MB en ~300 KB.
const LADO_MAX = 1800;
const CALIDAD = 0.85;

// Reduce la foto en el navegador antes de enviarla. Motivo: la Server
// Action viaja en el cuerpo de la petición y hay dos topes que una foto
// de móvil se salta de sobra: 1 MB por defecto en Next (subido a 4 MB en
// next.config.ts) y 4,5 MB fijos en las funciones de Vercel. Encoger
// aquí evita ambos sin cambiar de arquitectura; si algo falla (formato
// raro, navegador viejo) se envía el archivo tal cual y el servidor
// responde con un mensaje claro.
export default function CampoPortada({ imagenActual }: Props) {
  const [previa, setPrevia] = useState<string | null>(null);
  const [nota, setNota] = useState<string | null>(null);

  async function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const original = input.files?.[0];
    if (!original) {
      setPrevia(null);
      setNota(null);
      return;
    }

    try {
      const reducida = await reducirImagen(original);
      if (reducida && reducida.size < original.size) {
        const dt = new DataTransfer();
        dt.items.add(reducida);
        input.files = dt.files;
        setNota(`Foto preparada (${formatoMB(reducida.size)}, antes ${formatoMB(original.size)}).`);
      } else {
        setNota(`Foto lista (${formatoMB(original.size)}).`);
      }
      setPrevia(URL.createObjectURL(input.files![0]));
    } catch {
      setNota(`Foto lista (${formatoMB(original.size)}).`);
      setPrevia(URL.createObjectURL(original));
    }
  }

  const src = previa ?? imagenActual;

  return (
    <div>
      {/* label y no <p>: era el único campo del proyecto sin etiqueta
          asociada, y un lector de pantalla anunciaba solo "botón
          Seleccionar archivo", sin decir de qué. */}
      <label htmlFor="portada" className="block text-base font-medium text-oliva-700">
        Foto de portada
      </label>
      {src && (
        /* eslint-disable-next-line @next/next/no-img-element -- URL de Supabase Storage o blob local, sin dominio fijo que declarar en next.config */
        <img
          src={src}
          alt={previa ? "Nueva foto de portada, sin guardar todavía" : "Foto de portada actual de tu negocio"}
          className="mt-2 h-32 w-full rounded-xl object-cover"
        />
      )}
      <input
        id="portada"
        type="file"
        name="portada"
        accept="image/*"
        onChange={alElegir}
        aria-describedby="portada-ayuda"
        className="mt-2 block w-full text-base text-oliva-700 file:mr-3 file:rounded-full file:border-0 file:bg-oliva-100 file:px-4 file:py-2.5 file:text-base file:font-medium file:text-oliva-700 hover:file:bg-oliva-600 hover:file:text-white"
      />
      <p id="portada-ayuda" className="mt-1 text-sm text-oliva-600" aria-live="polite">
        {nota ?? "Deja este campo vacío para mantener la foto actual."}
      </p>
    </div>
  );
}

function formatoMB(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

async function reducirImagen(archivo: File): Promise<File | null> {
  if (!archivo.type.startsWith("image/")) return null;
  // GIF animado o SVG: no se tocan.
  if (archivo.type === "image/gif" || archivo.type === "image/svg+xml") return null;

  // createImageBitmap respeta la orientación EXIF (imageOrientation:
  // "from-image" es el valor por defecto en navegadores actuales), así
  // que una foto vertical de móvil no sale tumbada.
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", CALIDAD)
  );
  if (!blob) return null;

  const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], nombre, { type: "image/jpeg" });
}
