import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { paginasDelUsuario } from "@/lib/facebook";
import { leerTokenTemporal, usuarioMiembro } from "@/lib/facebook-conexion";
import { elegirPagina } from "@/lib/actions/facebook";

export const metadata: Metadata = {
  title: "Elige tu página de Facebook · Jaén Guía",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Solo se llega aquí desde el callback OAuth cuando la cuenta
// administra más de una página. El token vive en una cookie cifrada de
// 10 minutos; si ha caducado, se vuelve a empezar.
export default async function ElegirPaginaFacebook({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?volver=${encodeURIComponent(`/panel/${slug}`)}`);

  const { data: negocio } = await supabase.from("negocios").select("id, nombre").eq("slug", slug).maybeSingle();
  if (!negocio || !(await usuarioMiembro(supabase, negocio.id, user.id))) notFound();

  const token = await leerTokenTemporal();
  if (!token) {
    redirect(`/panel/${slug}?error=${encodeURIComponent("La conexión con Facebook ha caducado. Vuelve a pulsar «Conectar».")}#facebook`);
  }

  let paginas: Awaited<ReturnType<typeof paginasDelUsuario>> = [];
  try {
    paginas = await paginasDelUsuario(token);
  } catch {
    redirect(`/panel/${slug}?error=${encodeURIComponent("Facebook no responde. Inténtalo más tarde.")}#facebook`);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm text-oliva-600">
        <Link href={`/panel/${slug}`} className="hover:underline">
          ‹ Volver al panel
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-oliva-900">
        ¿Qué página es la de {negocio.nombre}?
      </h1>
      <p className="mt-2 text-base text-oliva-700">
        Tu cuenta administra varias páginas. Elige la del local: leeremos sus eventos y publicaciones (y su
        Instagram, si lo tiene vinculado) para proponerte eventos en el panel.
      </p>

      <form action={elegirPagina} className="mt-6 space-y-3">
        <input type="hidden" name="negocio_id" value={negocio.id} />
        <input type="hidden" name="slug" value={slug} />
        {paginas.map((p, i) => (
          <label
            key={p.id}
            className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-4 shadow-sm has-[:checked]:ring-2 has-[:checked]:ring-terracota-500"
          >
            <input type="radio" name="page_id" value={p.id} defaultChecked={i === 0} required className="h-5 w-5 accent-terracota-600" />
            <span className="flex-1">
              <span className="block text-base font-semibold text-oliva-900">{p.name}</span>
              {p.instagram_business_account?.username && (
                <span className="block text-sm text-oliva-600">Instagram: @{p.instagram_business_account.username}</span>
              )}
            </span>
          </label>
        ))}
        <button
          type="submit"
          className="mt-2 inline-flex min-h-11 items-center rounded-full bg-terracota-600 px-5 text-base font-semibold text-white hover:bg-terracota-700 transition-colors"
        >
          Conectar esta página
        </button>
      </form>
    </main>
  );
}
