import Link from "next/link";

export const metadata = {
  title: "Condiciones de Uso · Jaén Guía",
  robots: { index: false, follow: false },
};

export default function TerminosPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <h1 className="font-display text-4xl font-bold text-oliva-900 mb-2">
          Condiciones de Uso
        </h1>
        <p className="text-sm text-oliva-500 mb-8">Última actualización: 14 de septiembre de 2026</p>

        <div className="texto-legal text-oliva-700 space-y-4">
          <p>
            Estas condiciones regulan el uso de Jaén Guía (jaenguia.com). Al crear una
            cuenta o usar los servicios de pago aceptas estas condiciones, el{" "}
            <Link href="/aviso-legal" className="underline">aviso legal</Link> y la{" "}
            <Link href="/privacidad" className="underline">política de privacidad</Link>.
          </p>

          <h2>1. Cuentas de usuario</h2>
          <p>
            Para dejar reseñas o guardar favoritos necesitas una cuenta. Debes facilitar
            datos veraces, mantener la confidencialidad de tu contraseña y usar la cuenta
            de forma personal. Puedes eliminar tu cuenta en cualquier momento.
          </p>

          <h2>2. Reseñas y contenidos de usuarios</h2>
          <p>
            Las reseñas deben basarse en experiencias reales y respetar la ley y a las
            demás personas. No se permiten contenidos falsos, difamatorios, ofensivos,
            spam ni que infrinjan derechos de terceros. Podemos retirar contenidos que
            incumplan estas normas o suspender cuentas que abusen del servicio. Al
            publicar contenido nos concedes una licencia no exclusiva para mostrarlo en
            el portal.
          </p>

          <h2>3. Negocios y gestión de fichas</h2>
          <p>
            Quien solicite gestionar la ficha de un negocio declara estar autorizado para
            ello. Verificamos las solicitudes antes de aprobarlas. El gestor es
            responsable de que la información publicada de su negocio sea correcta y
            lícita.
          </p>

          <h2>4. Productos de pago</h2>
          <p>
            Ofrecemos productos de promoción para negocios:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Evento promocionado</strong>: pago único de 5&nbsp;€ (IVA incluido) que destaca un evento hasta que se celebra.</li>
            <li><strong>Plan Destacado</strong>: suscripción mensual de 14,99&nbsp;€ (IVA incluido) que destaca el negocio y sus eventos mientras esté activa.</li>
          </ul>
          <p>
            Los pagos se procesan a través de Stripe. La suscripción se renueva
            automáticamente cada mes hasta que la canceles; puedes cancelarla desde tu
            panel y seguirás siendo Destacado hasta el final del periodo ya pagado. Las
            facturas se generan automáticamente. Los precios pueden actualizarse
            avisándote con antelación.
          </p>

          <h2>5. Desistimiento y reembolsos</h2>
          <p>
            Al tratarse de servicios digitales que comienzan a prestarse de inmediato,
            solicitas su ejecución antes de que finalice el plazo de desistimiento. Para
            cualquier incidencia con un pago escríbenos a{" "}
            <a href="mailto:hola@jaenguia.com" className="underline">hola@jaenguia.com</a>{" "}
            y buscaremos una solución razonable.
          </p>

          <h2>6. Disponibilidad y responsabilidad</h2>
          <p>
            Trabajamos para mantener el servicio disponible y la información actualizada,
            pero no garantizamos la ausencia de interrupciones ni la exactitud completa
            de los datos de negocios y eventos, que pueden proceder de fuentes públicas.
            En la medida permitida por la ley, no respondemos de daños indirectos
            derivados del uso del portal.
          </p>

          <h2>7. Cambios y ley aplicable</h2>
          <p>
            Podemos modificar estas condiciones; publicaremos la versión vigente en esta
            página con su fecha de actualización. Se rigen por la legislación española.
          </p>
        </div>
      </main>
    </>
  );
}
