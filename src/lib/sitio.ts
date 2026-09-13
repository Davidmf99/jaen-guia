// URL pública del sitio para enlaces absolutos (correos, Stripe, OG).
// Vale también en Client Components: solo lee NEXT_PUBLIC_*.
export function urlSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
