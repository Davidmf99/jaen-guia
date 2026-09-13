import type { Metadata } from "next";
import Link from "next/link";
import { Search, UserCheck, PencilLine, CalendarPlus, Star, Clock, Camera, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PRECIO_EVENTO_PROMOCIONADO, PRECIO_PLAN_DESTACADO } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Para negocios · Jaén Guía",
  description:
    "Tu bar, tienda o local ya está en Jaén Guía. Reclama tu ficha gratis y gestiona horarios, fotos, especialidades y eventos.",
};

// Landing a la que mandar a los dueños (QR en el local, WhatsApp, cara
// a cara). Su trabajo es uno: que busquen su negocio y pulsen "¿Es tu
// negocio?" en la ficha. Todo lo demás es contexto para que se fíen.

const PASOS = [
  {
    icono: Search,
    titulo: "Busca tu local",
    texto: "Casi seguro que ya está: hemos cargado más de 400 negocios de Jaén capital con su dirección, teléfono y horario.",
  },
  {
    icono: UserCheck,
    titulo: "Pide gestionarlo",
    texto: "En su ficha, pulsa «¿Es tu negocio?». Te llamamos al teléfono del local para confirmar que eres tú. Sin papeleo.",
  },
  {
    icono: PencilLine,
    titulo: "Edita lo que quieras",
    texto: "Horario real, foto de portada, qué hay que probar, si tenéis terraza o menú del día, tu Instagram.",
  },
  {
    icono: CalendarPlus,
    titulo: "Publica lo que pasa",
    texto: "Conciertos, catas, cenas especiales. Salen en la agenda de la portada, donde mira la gente el jueves para el finde.",
  },
];

const VENTAJAS = [
  { icono: Clock, texto: "Aparece en «Abierto ahora» y en los filtros de terraza, reservas o menú del día." },
  { icono: Camera, texto: "Tu foto en vez de la de Google, y las especialidades que tú decides." },
  { icono: Star, texto: "Reseñas de gente de Jaén, no de turistas de paso." },
  { icono: Sparkles, texto: "Gratis. Sin comisiones, sin app que instalar, sin permanencia." },
];

export default async function ParaNegociosPage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("negocios")
    .select("id", { count: "exact", head: true })
    .eq("activo", true);
  const total = count ?? 400;
  const redondeado = Math.floor(total / 50) * 50;

  return (
    <main className="min-h-screen bg-tierra-50 pb-24">
      <header className="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('/noise.svg')]" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          <span className="mb-5 inline-block rounded-full border border-terracota-500/20 bg-terracota-500/10 px-4 py-1.5 text-sm font-bold uppercase tracking-[0.2em] text-terracota-600">
            Para negocios
          </span>
          <h1 className="font-display text-5xl leading-[0.95] tracking-tight text-oliva-900 md:text-7xl">
            Tu local ya está en Jaén Guía. Hazlo tuyo.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-oliva-700 md:text-xl">
            Más de {redondeado} bares, tiendas y sitios de Jaén capital ya tienen ficha. Reclama la
            tuya gratis y decide tú qué se cuenta de tu negocio.
          </p>

          <form action="/buscar" method="get" className="mx-auto mt-10 flex max-w-xl flex-col gap-3 sm:flex-row">
            <label htmlFor="q" className="sr-only">
              Nombre de tu negocio
            </label>
            <input
              id="q"
              name="q"
              type="search"
              required
              placeholder="Nombre de tu negocio"
              className="min-h-12 flex-1 rounded-full border border-oliva-100 bg-white px-5 text-base text-oliva-900 shadow-sm outline-none focus:border-terracota-400"
            />
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-oliva-900 px-6 text-base font-bold text-white hover:bg-terracota-700 transition-colors"
            >
              <Search size={18} aria-hidden="true" />
              Buscar mi local
            </button>
          </form>
          <p className="mt-3 text-sm text-oliva-600">
            ¿No aparece?{" "}
            <Link href="/contacto" className="font-semibold text-terracota-600 hover:underline">
              Escríbenos
            </Link>{" "}
            y lo damos de alta en el día.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6">
        <h2 className="mb-8 font-sans text-sm font-bold uppercase tracking-[0.2em] text-terracota-600">
          Cómo funciona
        </h2>
        <ol className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((paso, i) => (
            <li key={paso.titulo} className="rounded-[2rem] border border-oliva-100 bg-white p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="mb-5 flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-tierra-50 text-oliva-700">
                  <paso.icono size={22} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span className="font-display text-3xl text-oliva-200" aria-hidden="true">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-sans text-lg font-bold text-oliva-900">{paso.titulo}</h3>
              <p className="mt-2 text-oliva-700">{paso.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-10 rounded-[2.5rem] bg-oliva-900 p-8 text-white md:grid-cols-2 md:p-14">
          <div>
            <h2 className="font-display text-3xl leading-tight md:text-4xl">
              Lo que ganas, sin pagar nada
            </h2>
            <p className="mt-4 text-white/80">
              Jaén Guía la usa gente de aquí para decidir dónde ir esta tarde. Que tu ficha esté
              completa es la diferencia entre salir o no en esa búsqueda.
            </p>
            <Link
              href="/registro"
              className="mt-8 inline-flex min-h-12 items-center rounded-full bg-white px-6 text-base font-bold text-oliva-900 hover:bg-tierra-100 transition-colors"
            >
              Crear cuenta gratis
            </Link>
          </div>
          <ul className="space-y-4">
            {VENTAJAS.map(({ icono: Icono, texto }) => (
              <li key={texto} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Icono size={18} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span className="text-lg leading-snug">{texto}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="destacado" className="mx-auto mt-20 max-w-6xl scroll-mt-24 px-6">
        <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-[0.2em] text-terracota-600">
          Si quieres más visibilidad
        </h2>
        <p className="mb-8 max-w-2xl text-lg text-oliva-700">
          Lo básico es gratis y lo seguirá siendo. Esto es lo que puedes añadir cuando quieras que
          te vea más gente. Se activa desde tu panel, con tarjeta, y sin permanencia.
        </p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <article className="rounded-[2rem] border border-oliva-100 bg-white p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h3 className="flex items-center gap-2 font-sans text-xl font-bold text-oliva-900">
              <Sparkles size={22} strokeWidth={1.5} className="text-terracota-500" aria-hidden="true" />
              Evento promocionado
            </h3>
            <p className="mt-1 font-display text-3xl text-oliva-900">
              {PRECIO_EVENTO_PROMOCIONADO} <span className="text-base font-sans text-oliva-600">por evento</span>
            </p>
            <p className="mt-3 text-oliva-700">
              Tu concierto, cata o partido arriba en la agenda y en la portada hasta que se celebre.
              Pago único, para cuando tienes algo puntual que llenar.
            </p>
          </article>
          <article className="rounded-[2rem] bg-oliva-900 p-7 text-white shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
            <h3 className="flex items-center gap-2 font-sans text-xl font-bold">
              <Star size={22} strokeWidth={1.5} className="text-terracota-500" aria-hidden="true" />
              Plan Destacado
            </h3>
            <p className="mt-1 font-display text-3xl">
              {PRECIO_PLAN_DESTACADO.replace("/mes", "")} <span className="text-base font-sans text-white/70">al mes</span>
            </p>
            <ul className="mt-3 space-y-1.5 text-white/85">
              <li>· Tu ficha en la portada y arriba en su categoría, con insignia.</li>
              {/* Sin "revisamos tu Instagram a mano": Managed Payments solo
                  admite servicios automáticos, sin trabajo manual en la oferta.
                  Se sigue haciendo como cortesía (admin/destacados-sin-eventos),
                  pero no se vende. */}
              <li>· Todos tus eventos promocionados, sin pagar uno a uno.</li>
            </ul>
            <p className="mt-4 text-sm text-white/60">Cancelas cuando quieras desde tu panel.</p>
          </article>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-3xl px-6">
        <h2 className="mb-6 font-sans text-sm font-bold uppercase tracking-[0.2em] text-terracota-600">
          Preguntas habituales
        </h2>
        <dl className="divide-y divide-oliva-100 rounded-[2rem] border border-oliva-100 bg-white px-7">
          {[
            ["¿Cuánto cuesta?", "Nada para lo básico: ficha, horario, fotos, especialidades y eventos. Si quieres más visibilidad, arriba tienes las dos opciones de pago."],
            ["¿Cómo sabéis que el negocio es mío?", "Te llamamos al teléfono que tiene el local en Google (o al que nos dejes) y lo confirmamos. Suele ser el mismo día."],
            ["Tengo dos locales, ¿puedo llevar los dos?", "Sí. Reclamas cada uno desde su ficha y los gestionas desde la misma cuenta."],
            ["¿Y si mi negocio no aparece?", "Escríbenos con el nombre y la dirección y lo damos de alta. Después lo reclamas igual."],
            ["¿Puedo darle acceso a un empleado?", "De momento no desde la web; escríbenos y lo vinculamos nosotros."],
          ].map(([q, a]) => (
            <div key={q} className="py-5">
              <dt className="font-bold text-oliva-900">{q}</dt>
              <dd className="mt-1 text-oliva-700">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
