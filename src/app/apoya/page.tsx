import type { Metadata } from "next";
import Link from "next/link";
import { Coffee, Star, Handshake, Check } from "lucide-react";
import { PRECIO_PLAN_DESTACADO } from "@/lib/stripe";

// Página de apoyo. Jaén Guía la hace una persona y tiene costes fijos
// pequeños; aquí se explica sin dramatizar y se ofrecen tres formas de
// echar una mano, de menor a mayor: aportación puntual (enlace de pago
// de Stripe con importe libre), destacar el negocio (el plan de pago
// que ya existe) y patrocinio local (contacto).
//
// "Aportación" y no "donativo" a propósito: donativo suena a ONG y
// aquí no hay entidad sin ánimo de lucro detrás, es un proyecto
// personal.

export const metadata: Metadata = {
  title: "Apoya Jaén Guía · Jaén Guía",
  description: "Jaén Guía la hace una persona de Jaén, sin publicidad. Si te sirve, puedes echar una mano con una aportación, destacando tu negocio o como patrocinador local.",
  alternates: { canonical: "/apoya" },
};

const ENLACE_APORTACION = "https://donate.stripe.com/6oU7sF198fLL6wc55F8Zq00";

interface PageProps {
  searchParams: Promise<{ gracias?: string }>;
}

const EN_QUE_SE_VA = [
  "El dominio y el servidor donde vive la web.",
  "La lectura diaria de lo que publican bares, salas y agendas para rellenar los eventos.",
  "El modelo que lee los carteles y saca fecha, hora y lugar.",
  "Las horas de una persona: la mayor parte.",
];

export default async function ApoyaPage({ searchParams }: PageProps) {
  const { gracias } = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 md:py-20">
      {gracias && (
        <p role="status" className="mb-8 flex items-center gap-2 rounded-2xl bg-oliva-100 px-5 py-4 text-base font-semibold text-oliva-900">
          <Check size={18} aria-hidden="true" /> Gracias. De verdad. Con esto la web sigue un mes más sin anuncios.
        </p>
      )}

      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-terracota-600">Apoya Jaén Guía</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-oliva-900 md:text-5xl">Esto lo hace una persona</h1>
      <div className="mt-6 space-y-4 text-lg text-oliva-700">
        <p>
          Jaén Guía no es de una empresa ni de una institución. La hace un desarrollador de Jaén con el tiempo que le deja
          el trabajo, porque quería una web donde mirar qué hacer hoy en su ciudad sin abrir seis apps.
        </p>
        <p>
          No hay anuncios ni se venden tus datos. Los bares y sitios están gratis, y la agenda se rellena sola cada mañana.
          Lo que cuesta mantenerla es poco, pero no es cero:
        </p>
        <ul className="space-y-2 pl-1">
          {EN_QUE_SE_VA.map((t) => (
            <li key={t} className="flex gap-3">
              <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-terracota-500" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <p>Si la web te sirve, hay tres formas de echar una mano. Ninguna es obligatoria; la web sigue igual para todos.</p>
      </div>

      <div className="mt-12 grid gap-4">
        <section className="rounded-[1.5rem] border border-oliva-100 bg-white p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tierra-50 text-terracota-600">
              <Coffee size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-semibold text-oliva-900">Una aportación puntual</h2>
              <p className="mt-1 text-oliva-700">
                Lo que quieras, desde 1 €. Un café son 2 €; un mes de servidor, 5 €. Pago seguro con tarjeta a través de
                Stripe; no hace falta cuenta.
              </p>
              <a
                href={ENLACE_APORTACION}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-oliva-900 px-6 font-semibold text-white transition-colors hover:bg-oliva-700"
              >
                Aportar &rsaquo;
              </a>
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-oliva-100 bg-white p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tierra-50 text-terracota-600">
              <Star size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-semibold text-oliva-900">Si tienes un negocio: destácalo</h2>
              <p className="mt-1 text-oliva-700">
                Es la forma en que la web se paga sola. Tu bar, tienda o local sale en la portada, arriba en su categoría y con
                insignia, desde {PRECIO_PLAN_DESTACADO}, sin permanencia. Y cada evento que publiques puede ir promocionado por 5 €.
              </p>
              <Link
                href="/para-negocios#destacado"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-oliva-900 px-6 font-semibold text-oliva-900 transition-colors hover:bg-oliva-100"
              >
                Ver cómo funciona &rsaquo;
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-oliva-100 bg-white p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tierra-50 text-terracota-600">
              <Handshake size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-semibold text-oliva-900">Si eres una empresa de Jaén: patrocina</h2>
              <p className="mt-1 text-oliva-700">
                Un hueco fijo, discreto y con tu nombre en la portada y en la agenda: &ldquo;Con la colaboración de&rdquo;. Una sola
                marca a la vez, de Jaén. Cuéntame qué tienes en mente y lo vemos.
              </p>
              <a
                href="mailto:hola@jaenguia.com?subject=Patrocinio%20Ja%C3%A9n%20Gu%C3%ADa"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-oliva-900 px-6 font-semibold text-oliva-900 transition-colors hover:bg-oliva-100"
              >
                Escribir a hola@jaenguia.com &rsaquo;
              </a>
            </div>
          </div>
        </section>
      </div>

      <p className="mt-10 text-sm text-oliva-600">
        Las aportaciones no dan acceso a nada especial ni influyen en qué sale en la guía. Si quieres una factura, escribe a{" "}
        <a href="mailto:hola@jaenguia.com" className="underline underline-offset-4">hola@jaenguia.com</a>.
      </p>
    </main>
  );
}
