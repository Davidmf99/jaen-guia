import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MenuMovil from "./MenuMovil";
import MenuCuenta from "./MenuCuenta";
import MedidorCabecera from "./MedidorCabecera";
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
  let tieneNegocios = false;
  let esAdmin = false;
  if (user) {
    const [{ data: perfil }, { count }] = await Promise.all([
      supabase.from("perfiles").select("nombre, rol").eq("id", user.id).single(),
      // Cualquier membresía (también pendiente): así quien acaba de
      // reclamar su negocio encuentra dónde ver el estado.
      supabase
        .from("negocios_miembros")
        .select("negocio_id", { count: "exact", head: true })
        .eq("perfil_id", user.id),
    ]);
    nombreMostrado = perfil?.nombre || user.email || "Mi cuenta";
    tieneNegocios = (count ?? 0) > 0;
    esAdmin = perfil?.rol === "admin";
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
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-oliva-100/50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="-ml-2 flex min-h-11 items-center gap-2 rounded-xl px-2" aria-label="Jaén Guía, ir al inicio">
          <Image
            src="/images/logo.svg"
            /* El enlace ya lleva aria-label, así que repetirlo aquí hace
               que un lector de pantalla lo anuncie dos veces. */
            alt=""
            width={52}
            height={42}
            className="h-10 w-auto md:h-11"
            priority
          />
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-base font-medium text-oliva-700">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center hover:text-terracota-600 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {nombreMostrado ? (
          <MenuCuenta nombre={nombreMostrado} tieneNegocios={tieneNegocios} esAdmin={esAdmin} cerrarSesion={cerrarSesion} />
        ) : (
          <Link
            href="/login"
            className="hidden md:inline-flex min-h-11 items-center rounded-full border border-oliva-600 px-5 text-base font-medium text-oliva-700 hover:bg-oliva-600 hover:text-white transition-colors"
          >
            Iniciar sesión
          </Link>
        )}

        <MenuMovil enlaces={navLinks} mostrarLogin={!nombreMostrado} />
        <MedidorCabecera />
      </div>
    </header>
  );
}
