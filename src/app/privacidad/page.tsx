import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad · Jaén Guía",
  robots: { index: false, follow: false },
};

// NOTA PARA EL TITULAR: los datos identificativos entre corchetes
// [ASÍ] hay que rellenarlos con los datos fiscales reales antes de
// considerar esta política definitiva (nombre/razón social, NIF y
// domicilio). El resto describe el tratamiento real que hace la web.
export default function PrivacidadPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <h1 className="font-display text-4xl font-bold text-oliva-900 mb-2">
          Política de Privacidad
        </h1>
        <p className="text-sm text-oliva-500 mb-8">Última actualización: 14 de septiembre de 2026</p>

        <div className="texto-legal text-oliva-700 space-y-4">
          <p>
            En Jaén Guía tratamos los datos personales conforme al Reglamento (UE)
            2016/679 (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD). Esta política
            explica qué datos recogemos, para qué, con qué base legal, con quién los
            compartimos y qué derechos tienes.
          </p>

          <h2>1. Responsable del tratamiento</h2>
          <p>
            Titular: <strong>[TITULAR / RAZÓN SOCIAL]</strong>, NIF <strong>[NIF]</strong>,
            domicilio en <strong>[DIRECCIÓN FISCAL]</strong>.
            Contacto en materia de datos:{" "}
            <a href="mailto:hola@jaenguia.com" className="underline">hola@jaenguia.com</a>.
          </p>

          <h2>2. Qué datos tratamos y con qué finalidad</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Cuenta de usuario:</strong> nombre, apellidos, nombre de usuario,
              correo electrónico y, opcionalmente, si eres de Jaén. Finalidad: crear y
              gestionar tu cuenta, permitirte dejar reseñas y guardar favoritos.
            </li>
            <li>
              <strong>Reseñas y favoritos:</strong> la puntuación y el texto que publicas,
              y los negocios que marcas. Tu nombre y usuario se muestran junto a tus
              reseñas públicas.
            </li>
            <li>
              <strong>Negocios (dueños/gestores):</strong> datos del local (nombre,
              dirección, teléfono, web, redes, horario, fotos) y datos de contacto de
              quien solicita gestionarlo. Finalidad: publicar y mantener la ficha.
            </li>
            <li>
              <strong>Pagos:</strong> si contratas un producto de pago (evento
              promocionado o plan Destacado), los datos de facturación y de tarjeta los
              trata directamente Stripe; nosotros conservamos identificadores de cliente
              y de suscripción, no el número de tarjeta.
            </li>
            <li>
              <strong>Mensajes de WhatsApp (dueños):</strong> si envías el cartel de un
              evento a nuestro número, tratamos tu número, el mensaje y la imagen para
              convertirlo en un borrador de evento.
            </li>
            <li>
              <strong>Datos técnicos:</strong> registros básicos del servidor y de
              seguridad (incluida la dirección IP para limitar abusos y detectar fraude).
            </li>
          </ul>

          <h2>3. Base jurídica</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Ejecución de un contrato</strong> (art. 6.1.b RGPD): tu cuenta, la gestión de tu ficha de negocio y los productos de pago.</li>
            <li><strong>Consentimiento</strong> (art. 6.1.a): la publicación de reseñas y el envío de carteles por WhatsApp.</li>
            <li><strong>Interés legítimo</strong> (art. 6.1.f): seguridad del servicio, prevención de abuso y fraude.</li>
            <li><strong>Obligación legal</strong> (art. 6.1.c): conservación de facturas y datos fiscales de los pagos.</li>
          </ul>

          <h2>4. Destinatarios y encargados del tratamiento</h2>
          <p>Para prestar el servicio recurrimos a proveedores que tratan datos por cuenta nuestra o como responsables independientes:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Supabase</strong> — base de datos, autenticación y almacenamiento de imágenes (alojamiento en la UE, Irlanda).</li>
            <li><strong>Vercel</strong> — alojamiento y entrega de la web.</li>
            <li><strong>Stripe</strong> — procesamiento de pagos y facturación.</li>
            <li><strong>Resend</strong> — envío de correos transaccionales (confirmaciones, avisos).</li>
            <li><strong>Meta (WhatsApp / Facebook / Instagram)</strong> — recepción de carteles por WhatsApp y lectura de publicaciones públicas de negocios que las tienen enlazadas.</li>
            <li><strong>OpenRouter / Google (Gemini)</strong> — lectura automática del texto de los carteles de eventos que se envían o publican.</li>
            <li><strong>Apify</strong> — lectura de publicaciones públicas de redes sociales para nutrir la agenda de eventos.</li>
            <li><strong>Google Places</strong> — fotos y datos públicos de negocios.</li>
          </ul>
          <p>
            No vendemos tus datos ni los cedemos con fines publicitarios de terceros.
            Algunos proveedores pueden estar ubicados fuera del Espacio Económico
            Europeo; en esos casos las transferencias se amparan en las cláusulas
            contractuales tipo de la Comisión Europea u otras garantías adecuadas.
          </p>

          <h2>5. Conservación</h2>
          <p>
            Conservamos los datos de tu cuenta mientras la mantengas activa. Si la
            eliminas, borramos o anonimizamos tus datos, salvo los que debamos conservar
            por obligación legal (por ejemplo, facturas durante los plazos fiscales).
          </p>

          <h2>6. Tus derechos</h2>
          <p>
            Puedes ejercer los derechos de acceso, rectificación, supresión, oposición,
            limitación y portabilidad, así como retirar tu consentimiento, escribiendo a{" "}
            <a href="mailto:hola@jaenguia.com" className="underline">hola@jaenguia.com</a>.
            También puedes reclamar ante la Agencia Española de Protección de Datos
            (<a href="https://www.aepd.es" className="underline" rel="noopener noreferrer" target="_blank">aepd.es</a>) si consideras que no hemos atendido tu solicitud.
          </p>

          <h2>7. Cookies</h2>
          <p>
            Usamos únicamente cookies técnicas estrictamente necesarias (por ejemplo,
            para mantener tu sesión iniciada), que no requieren consentimiento. No
            usamos cookies de analítica ni de publicidad de terceros. Más detalle en la{" "}
            <Link href="/cookies" className="underline">política de cookies</Link>.
          </p>
        </div>
      </main>
    </>
  );
}
