import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import BarraProgreso from "@/components/layout/BarraProgreso";

import { Playfair_Display, Inter } from "next/font/google";

// ... (skipping some comments)
const playfair = Playfair_Display({
  variable: "--fuente-display",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--fuente-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Necesario para que las imágenes de Open Graph declaradas con ruta
  // relativa (p. ej. la de un evento subida a /public) se compartan como
  // URL absoluta: WhatsApp y compañía no resuelven rutas relativas. Sin
  // esto Next avisa por consola y cae a localhost, que en producción
  // deja el compartido sin imagen.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: "Jaén Guía · Alma de la Tierra",
  description:
    "Guía de gastronomía, cultura y ocio de Jaén: descubre bares, tiendas, eventos y experiencias, hechas por y para jiennenses y visitantes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`h-full antialiased ${playfair.variable} ${inter.variable}`}
    >
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {/* Suspense porque BarraProgreso lee los search params: sin él, las
            páginas estáticas pasarían a renderizarse en cliente. */}
        <Suspense fallback={null}>
          <BarraProgreso />
        </Suspense>
        {/* La cabecera vive en el layout, no en cada página: así se queda
            fija mientras carga la ruta siguiente (los `loading.tsx` solo
            sustituyen a la página) y el footer no sube. */}
        <Header />
        <div className="flex flex-1 flex-col">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
