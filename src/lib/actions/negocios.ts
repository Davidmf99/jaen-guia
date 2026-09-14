"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dentroDeLimite } from "@/lib/limites";
import {
  enviarCorreo,
  avisarAdmin,
  correoSolicitudRecibida,
  correoAdminNuevaSolicitud,
  correoSolicitudAprobada,
  correoSolicitudRechazada,
} from "@/lib/email";

/**
 * Un usuario logueado pide gestionar un negocio existente ("¿Es tu
 * negocio?" en la ficha). Crea la membresía en estado pendiente; la
 * RLS ("Usuario solicita gestionar un negocio", 0011) solo deja
 * insertar pendiente y para uno mismo, y la PK impide pedirlo dos veces.
 */
export async function solicitarGestionNegocio(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const slug = String(formData.get("slug") ?? "");
  const rutaFicha = `/negocio/${slug}`;

  if (!user) {
    redirect(`/login?volver=${encodeURIComponent(`${rutaFicha}#gestionar`)}`);
  }

  const negocioId = String(formData.get("negocio_id") ?? "");
  const mensaje = String(formData.get("mensaje") ?? "").trim().slice(0, 500) || null;
  const telefono = String(formData.get("telefono_contacto") ?? "").trim().slice(0, 30) || null;

  if (!negocioId || !slug) return;

  // Anti-abuso: frena a quien intente reclamar decenas de negocios en
  // ráfaga. La PK ya impide repetir el mismo negocio; esto acota el ritmo.
  if (!(await dentroDeLimite(supabase, `user:${user.id}`, "solicitud", 6, "1 hour"))) {
    redirect(`${rutaFicha}?solicitud=${encodeURIComponent("Has enviado muchas solicitudes seguidas. Espera un rato.")}#gestionar`);
  }

  const { error } = await supabase.from("negocios_miembros").insert({
    negocio_id: negocioId,
    perfil_id: user.id,
    rol: "dueno",
    estado: "pendiente",
    mensaje,
    telefono_contacto: telefono,
  });

  if (error) {
    // 23505: ya había una solicitud (pendiente, aprobada o rechazada).
    const texto =
      error.code === "23505"
        ? "Ya habías pedido gestionar este negocio."
        : "No hemos podido enviar la solicitud. Inténtalo de nuevo.";
    redirect(`${rutaFicha}?solicitud=${encodeURIComponent(texto)}#gestionar`);
  }

  // Acuse al dueño y aviso al admin. Si el correo falla, la solicitud
  // ya está guardada y se ve en /admin/solicitudes igualmente.
  const { data: negocio } = await supabase.from("negocios").select("nombre, slug").eq("id", negocioId).maybeSingle<{ nombre: string; slug: string }>();
  if (negocio && user.email) {
    const meta = user.user_metadata ?? {};
    const nombre = [meta.nombre, meta.apellidos].filter(Boolean).join(" ") || null;
    await Promise.all([
      enviarCorreo({ para: user.email, ...correoSolicitudRecibida(negocio) }),
      avisarAdmin(correoAdminNuevaSolicitud({ negocio, solicitante: { nombre, email: user.email }, mensaje, telefono })),
    ]);
  }

  revalidatePath(rutaFicha);
  revalidatePath("/panel");
  redirect(`${rutaFicha}?solicitud=ok#gestionar`);
}

/**
 * El admin aprueba o rechaza una solicitud desde /admin/solicitudes.
 * La RLS ("Admin gestiona membresias") es la que manda; aquí solo se
 * valida la forma. Al aprobar, un negocio dado de alta desde el panel
 * (activo = false) pasa a publicarse.
 */
export async function resolverSolicitudNegocio(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?volver=%2Fadmin%2Fsolicitudes");

  const negocioId = String(formData.get("negocio_id") ?? "");
  const perfilId = String(formData.get("perfil_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const slug = String(formData.get("slug") ?? "");

  if (!negocioId || !perfilId) return;
  if (decision !== "aprobar" && decision !== "rechazar") return;

  const estado = decision === "aprobar" ? "aprobado" : "rechazado";

  const { error } = await supabase
    .from("negocios_miembros")
    .update({ estado, resuelto_en: new Date().toISOString(), resuelto_por: user.id })
    .eq("negocio_id", negocioId)
    .eq("perfil_id", perfilId);

  if (error) {
    redirect(`/admin/solicitudes?error=${encodeURIComponent("No se ha podido guardar la decisión.")}`);
  }

  if (estado === "aprobado") {
    await supabase.from("negocios").update({ activo: true }).eq("id", negocioId).eq("activo", false);
  }

  await avisarSolicitante(negocioId, perfilId, estado);

  revalidatePath("/admin/solicitudes");
  revalidatePath("/panel");
  if (slug) {
    revalidatePath(`/negocio/${slug}`);
    revalidatePath(`/panel/${slug}`);
  }
  redirect(`/admin/solicitudes?ok=${encodeURIComponent(estado === "aprobado" ? "Solicitud aprobada." : "Solicitud rechazada.")}`);
}

// Aviso por correo al dueño. El email vive en auth.users, que el
// cliente de sesión no puede leer para otro usuario: hace falta el
// cliente admin (service_role). Si falta la clave, o el correo falla,
// la aprobación ya está hecha y solo se pierde el aviso.
async function avisarSolicitante(negocioId: string, perfilId: string, estado: "aprobado" | "rechazado") {
  const admin = createAdminClient();
  if (!admin) {
    console.warn("[email] sin SUPABASE_SERVICE_ROLE_KEY: no se avisa al solicitante");
    return;
  }

  const [{ data: usuario }, { data: negocio }] = await Promise.all([
    admin.auth.admin.getUserById(perfilId),
    admin.from("negocios").select("nombre, slug").eq("id", negocioId).single(),
  ]);

  const para = usuario?.user?.email;
  if (!para || !negocio) return;

  const correo =
    estado === "aprobado" ? correoSolicitudAprobada(negocio) : correoSolicitudRechazada(negocio);
  await enviarCorreo({ para, ...correo });
}
