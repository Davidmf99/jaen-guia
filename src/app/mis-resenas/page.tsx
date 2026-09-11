import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// La edición se hace en el formulario de la ficha del negocio (es el mismo
// que para crearla); desde aquí solo se enlaza a ella y se borra.
async function eliminarResena(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!id) return;

  // El filtro por usuario_id es redundante con la RLS, pero deja claro
  // que nunca se borra una reseña ajena.
  await supabase.from("resenas").delete().match({ id, usuario_id: user.id });

  revalidatePath("/mis-resenas");
  if (slug) revalidatePath(`/negocio/${slug}`);
}

export const metadata: Metadata = {
  title: "Mis reseñas · Jaén Guía",
  description: "Tus reseñas publicadas.",
};

interface ResenaPropia {
  id: string;
  puntuacion: number;
  texto: string | null;
  created_at: string;
  negocio: { nombre: string; slug: string } | null;
}

export default async function MisResenasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: resenas } = await supabase
    .from("resenas")
    .select("id, puntuacion, texto, created_at, negocio:negocios(nombre, slug)")
    .eq("usuario_id", user.id)
    .order("created_at", { ascending: false })
    .returns<ResenaPropia[]>();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-oliva-900">
          Mis reseñas escritas
        </h1>
        <p className="mt-2 text-oliva-700">
          Lugares en los que has dejado tu opinión.
        </p>
      </header>

      {!resenas || resenas.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-oliva-200 bg-white p-10 text-center">
          <p className="text-lg font-medium text-oliva-900">Todavía no has escrito ninguna reseña.</p>
          <p className="mt-1 text-oliva-600">Busca tus sitios favoritos y puntúalos.</p>
          <Link
            href="/buscar"
            className="mt-6 inline-flex rounded-full bg-oliva-900 px-6 py-3 font-semibold text-white transition-colors hover:bg-terracota-700"
          >
            Buscar sitios
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {resenas.map((resena) => (
            <li key={resena.id} className="rounded-2xl border border-oliva-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <Link href={`/negocio/${resena.negocio?.slug}`} className="font-sans text-xl font-bold text-oliva-900 hover:text-terracota-600 transition-colors">
                  {resena.negocio?.nombre}
                </Link>
                <div className="flex text-terracota-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} className={`h-5 w-5 ${i < resena.puntuacion ? "fill-current" : "fill-oliva-100"}`} viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
              {resena.texto ? (
                <p className="text-oliva-700 whitespace-pre-wrap">{resena.texto}</p>
              ) : (
                <p className="text-oliva-500 italic">Sin comentario, solo puntuación.</p>
              )}
              <div className="mt-4 flex items-center gap-4 text-sm font-semibold">
                <Link
                  href={`/negocio/${resena.negocio?.slug}#resenas`}
                  className="text-oliva-900 hover:text-terracota-600 hover:underline"
                >
                  Editar
                </Link>
                <form action={eliminarResena}>
                  <input type="hidden" name="id" value={resena.id} />
                  <input type="hidden" name="slug" value={resena.negocio?.slug ?? ""} />
                  <button
                    type="submit"
                    className="text-terracota-500 hover:text-terracota-700 hover:underline"
                  >
                    Eliminar
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

