"use client";

import { useEffect } from "react";
import EstadoErrorRuta from "@/components/EstadoErrorRuta";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EstadoErrorRuta
      mensaje="No hemos podido cargar la portada de Jaén Guía."
      retry={retry}
    />
  );
}
