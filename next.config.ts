import type { NextConfig } from "next";

// Content-Security-Policy en modo SOLO-INFORME (I-3). Se sirve como
// Content-Security-Policy-Report-Only a propósito: en una web con pagos
// reales, una CSP activa mal calibrada rompería el Checkout de Stripe
// (dinero). Report-Only no bloquea nada; anota las violaciones en la
// consola del navegador. Cuando se compruebe unos días que no salta con
// el uso normal (pago con Stripe, mapa, subida de portada), se promueve
// a activa renombrando la cabecera a "Content-Security-Policy".
//
// Orígenes contemplados: Stripe (script/marco/conexión), Supabase
// (datos vía https/wss y portadas en Storage), tiles de OpenStreetMap y
// marcadores de Leaflet (unpkg), fuentes autohospedadas por next/font.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://unpkg.com",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const CABECERAS_SEGURIDAD = [
  // Clickjacking: nadie debe poder meter el panel o el login en un iframe.
  { key: "X-Frame-Options", value: "DENY" },
  // Evita que el navegador "adivine" tipos MIME distintos del declarado.
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No usamos cámara, micrófono ni geolocalización: se deniegan.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // HTTPS obligatorio también en subdominios. (Vercel ya manda un HSTS
  // básico; esto lo hace explícito y con includeSubDomains.)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

const nextConfig: NextConfig = {
  // No anunciar el framework (quita la cabecera x-powered-by: Next.js).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: CABECERAS_SEGURIDAD }];
  },
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
