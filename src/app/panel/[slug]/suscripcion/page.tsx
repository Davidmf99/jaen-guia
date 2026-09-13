import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, Star } from "lucide-react";
import CancelarSuscripcion from "@/components/panel/CancelarSuscripcion";
import CambiarTarjeta from "@/components/panel/CambiarTarjeta";
import { negocioSuscrito, resumenSuscripcion } from "@/lib/suscripcion";

export const metadata: Metadata = {
  title: "Tu suscripción · Jaén Guía",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}

const FECHA = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long", year: "numeric" });
const FECHA_CORTA = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric" });

const MARCAS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express" };

const ESTADOS: Partial<Record<string, string>> = {
  active: "Activa",
  trialing: "En prueba",
  past_due: "Pago pendiente",
  unpaid: "Impagada",
  canceled: "Cancelada",
  incomplete: "Incompleta",
};

// Gestión del plan Destacado sin salir de Jaén Guía: estado, próximo
// cobro, tarjeta, facturas, cancelar/reanudar. Sustituye al portal de
// Stripe (misma información, misma API por debajo).
export default async function SuscripcionPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { ok, error } = await searchParams;
  const negocio = await negocioSuscrito(slug);
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null;

  const resumen = await resumenSuscripcion(negocio);
  if (!resumen) redirect(`/panel/${slug}?error=${encodeURIComponent("Este negocio no tiene ninguna suscripción.")}`);

  const fin = resumen.finPeriodo ? FECHA.format(new Date(resumen.finPeriodo)) : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/panel/${slug}`}
        className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-oliva-700 hover:text-terracota-600"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Volver al panel
      </Link>
      <header className="mt-4 mb-6">
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold text-oliva-900">
          <Star size={26} strokeWidth={1.5} className="text-terracota-500" aria-hidden="true" />
          Tu suscripción
        </h1>
        <p className="mt-2 text-oliva-700">
          Plan Destacado de <strong>{negocio.nombre}</strong>.
        </p>
      </header>

      {(ok || error) && (
        <p
          role="status"
          className={`mb-6 rounded-2xl px-4 py-3 text-base font-semibold ${
            error ? "bg-terracota-500/10 text-terracota-600" : "bg-oliva-100 text-oliva-900"
          }`}
        >
          {error ?? ok}
        </p>
      )}

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-bold uppercase tracking-wide text-oliva-600">Estado</dt>
            <dd className="mt-1 text-lg font-semibold text-oliva-900">
              {resumen.cancelaAlFinal ? "Cancelada" : (ESTADOS[resumen.estado] ?? resumen.estado)}
            </dd>
            {resumen.cancelaAlFinal && fin && (
              <dd className="text-base text-oliva-700">Sigues Destacado hasta el {fin}.</dd>
            )}
          </div>
          <div>
            <dt className="text-sm font-bold uppercase tracking-wide text-oliva-600">
              {resumen.cancelaAlFinal ? "Fin del plan" : "Próximo cobro"}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-oliva-900">
              {resumen.cancelaAlFinal ? fin ?? "—" : `${resumen.importe}${fin ? ` · ${fin}` : ""}`}
            </dd>
            {!resumen.cancelaAlFinal && <dd className="text-base text-oliva-700">IVA incluido. Sin permanencia.</dd>}
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm font-bold uppercase tracking-wide text-oliva-600">Tarjeta</dt>
            <dd className="mt-1 text-lg font-semibold text-oliva-900">
              {resumen.tarjeta
                ? `${MARCAS[resumen.tarjeta.marca] ?? resumen.tarjeta.marca} •••• ${resumen.tarjeta.ultimos4} · caduca ${resumen.tarjeta.caducidad}`
                : "Sin tarjeta guardada"}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap items-start gap-3 border-t border-oliva-100 pt-6">
          {publishableKey && <CambiarTarjeta slugNegocio={slug} publishableKey={publishableKey} />}
          <CancelarSuscripcion slugNegocio={slug} cancelaAlFinal={resumen.cancelaAlFinal} finPeriodo={fin} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-[0.2em] text-terracota-600">Facturas</h2>
        {resumen.facturas.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-base text-oliva-700 shadow-sm">Todavía no hay facturas.</p>
        ) : (
          <ul className="divide-y divide-oliva-100 rounded-2xl bg-white shadow-sm">
            {resumen.facturas.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <div>
                  <p className="font-semibold text-oliva-900">{FECHA_CORTA.format(new Date(f.fecha))}</p>
                  <p className="text-sm text-oliva-600">{f.pagada ? "Pagada" : "Pendiente"}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-oliva-900">{f.importe}</span>
                  {f.pdf && (
                    <a
                      href={f.pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-terracota-600 hover:underline"
                    >
                      <Download size={16} aria-hidden="true" />
                      PDF
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
