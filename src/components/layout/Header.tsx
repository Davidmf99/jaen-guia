import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown, Heart, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import MenuMovil from "./MenuMovil";
import { getCategorias } from "@/lib/categorias";

export default async function Header() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    categorias,
  ] = await Promise.all([supabase.auth.getUser(), getCategorias()]);

  const navLinks = [
    { href: "/", label: "Inicio" },
    ...categorias.map((c) => ({ href: `/${c.slug}`, label: c.nombre })),
  ];

  let nombreMostrado: string | null = null;
  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre")
      .eq("id", user.id)
      .single();
    nombreMostrado = perfil?.nombre || user.email || "Mi cuenta";
  }

  async function cerrarSesion() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
  }

  return (
    // Fondo opaco a propósito. Con bg-tierra-50/95 + backdrop-blur, el
    // buscador flotante del hero se transparentaba a través de la barra
    // al hacer scroll (se veía el botón "Buscar" naranja por detrás del
    // menú). Detrás de un fondo opaco el backdrop-blur no hace nada, así
    // que se quita también.
    <header className="sticky top-0 z-50 bg-tierra-50 border-b border-oliva-100">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/logo.svg"
            alt="Jaén Guía"
            width={52}
            height={42}
            className="h-10 w-auto md:h-[42px]"
            priority
          />
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-oliva-700">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-terracota-600 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {nombreMostrado ? (
          <div className="group relative">
            <button
              type="button"
              aria-haspopup="menu"
              className="flex items-center gap-1.5 rounded-full border border-oliva-100 px-4 py-1.5 text-sm font-medium text-oliva-700 hover:bg-oliva-100 transition-colors"
            >
              <span className="max-w-[10rem] truncate">{nombreMostrado}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>

            <div
              role="menu"
              className="invisible absolute right-0 top-full z-10 mt-1 w-48 rounded-2xl bg-white p-1.5 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
            >
              <Link
                href="/favoritos"
                role="menuitem"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-oliva-700 hover:bg-oliva-50"
              >
                <Heart size={14} aria-hidden="true" />
                Mis favoritos
              </Link>
              <form action={cerrarSesion}>
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-oliva-700 hover:bg-oliva-50"
                >
                  <LogOut size={14} aria-hidden="true" />
                  Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        ) : (
          <Link
            href="/login"
            className="hidden md:inline-block rounded-full border border-oliva-600 px-4 py-1.5 text-sm font-medium text-oliva-700 hover:bg-oliva-600 hover:text-white transition-colors"
          >
            Iniciar sesión
          </Link>
        )}

        <MenuMovil enlaces={navLinks} mostrarLogin={!nombreMostrado} />
      </div>
    </header>
  );
}
