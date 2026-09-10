import type { Metadata } from "next";
import RegistroForm from "@/components/auth/RegistroForm";

export const metadata: Metadata = {
  title: "Crear cuenta · Jaén Guía",
  description: "Regístrate en Jaén Guía para dejar reseñas y guardar tus favoritos.",
};

export default function RegistroPage() {
  return (
    <>
      <main className="min-h-screen bg-tierra-50 flex flex-col items-center pt-24 pb-20 px-6">
        <div className="w-full max-w-lg text-center mb-10">
          <h1 className="font-display text-5xl md:text-6xl tracking-tight text-oliva-900 mb-4">
            Crear cuenta.
          </h1>
          <p className="text-lg text-oliva-700">
            Únete a Jaén Guía para dejar reseñas y guardar tus lugares favoritos.
          </p>
        </div>

        <RegistroForm />
      </main>
    </>
  );
}
