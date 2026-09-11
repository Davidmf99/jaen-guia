import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cuerpo máximo de una Server Action. El valor por defecto es 1 MB y
  // la subida de portada desde /panel/[slug] lo superaba con cualquier
  // foto de móvil ("Body exceeded 1 MB limit"). 4 MB deja margen sin
  // pasar del tope de 4,5 MB por petición de las funciones de Vercel;
  // CampoPortada reduce la foto en el navegador antes de enviarla.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    // Portadas subidas desde /panel/[slug] viven en Supabase Storage
    // (bucket público negocios-portadas). El host sale de la URL del
    // proyecto para no dejar el id del proyecto fijo aquí; sin esto
    // next/image rechaza el src ("hostname is not configured").
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://localhost").hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
