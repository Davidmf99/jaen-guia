import "server-only";
import Stripe from "stripe";

// Un solo cliente por proceso. La versión de API la fija el SDK
// (stripe@22 → 2026-08-26); no la pisamos para que los tipos y la
// respuesta real coincidan.
let cliente: Stripe | null = null;

export function stripe() {
  if (!cliente) {
    const clave = process.env.STRIPE_SECRET_KEY;
    if (!clave) throw new Error("Falta STRIPE_SECRET_KEY");
    cliente = new Stripe(clave);
  }
  return cliente;
}

export const PRECIO_EVENTO_PROMOCIONADO = "5 €";
export const PRECIO_PLAN_DESTACADO = "14,99 €/mes";

/** Ventana de visibilidad de un evento promocionado antes de celebrarse. */
export const DIAS_PROMOCION = 14;

export function stripeConfigurado() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
      process.env.STRIPE_PRICE_EVENTO_PROMOCIONADO &&
      process.env.STRIPE_PRICE_DESTACADO
  );
}

export function urlSitio() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
