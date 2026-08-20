import type { Metadata } from "next";
import "./globals.css";

// Nota: en un entorno con acceso a internet, sustituye esto por
// `next/font/google` con Fraunces (título) e Inter (cuerpo), tal y como
// se referencian en globals.css (--font-display / --font-sans). Aquí se
// usa system-ui como fallback porque este entorno de build no tiene
// salida a fonts.googleapis.com.
//
// import { Fraunces, Inter } from "next/font/google";
// const fraunces = Fraunces({ variable: "--font-display", subsets: ["latin"] });
// const inter = Inter({ variable: "--font-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Jaén Guía · Alma de la Tierra",
  description:
    "Guía de gastronomía, cultura y ocio de Jaén: descubre bares, tiendas, eventos y experiencias, hechas por y para jiennenses y visitantes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
