import Link from "next/link";

export const metadata = {
  title: "Aviso Legal · Jaén Guía",
  robots: { index: false, follow: false },
};

// NOTA PARA EL TITULAR: rellena los datos entre corchetes [ASÍ] con los
// datos fiscales reales. El artículo 10 de la LSSICE OBLIGA a
// identificar al titular (nombre/razón social, NIF y domicilio) en una
// web con actividad económica; ahora mismo son marcadores.
export default function AvisoLegalPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <h1 className="font-display text-4xl font-bold text-oliva-900 mb-2">
          Aviso Legal
        </h1>
        <p className="text-sm text-oliva-500 mb-8">Última actualización: 14 de septiembre de 2026</p>

        <div className="texto-legal text-oliva-700 space-y-4">
          <p>
            En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de
            Servicios de la Sociedad de la Información y de Comercio Electrónico
            (LSSICE), se facilitan los datos identificativos del titular de este sitio.
          </p>

          <h2>1. Titular del sitio</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Titular: <strong>[TITULAR / RAZÓN SOCIAL]</strong></li>
            <li>NIF: <strong>[NIF]</strong></li>
            <li>Domicilio: <strong>[DIRECCIÓN FISCAL]</strong></li>
            <li>Correo de contacto: <a href="mailto:hola@jaenguia.com" className="underline">hola@jaenguia.com</a></li>
            <li>Sitio web: jaenguia.com</li>
          </ul>

          <h2>2. Objeto</h2>
          <p>
            Jaén Guía es un directorio y agenda digital de gastronomía, cultura, ocio y
            eventos de la provincia de Jaén. Permite consultar negocios y eventos, crear
            una cuenta, dejar reseñas, guardar favoritos y, a los negocios, gestionar su
            ficha y contratar productos de promoción.
          </p>

          <h2>3. Condiciones de uso</h2>
          <p>
            El uso del sitio y de sus servicios se rige por las{" "}
            <Link href="/terminos" className="underline">condiciones de uso</Link> y por la{" "}
            <Link href="/privacidad" className="underline">política de privacidad</Link>.
          </p>

          <h2>4. Propiedad intelectual e industrial</h2>
          <p>
            El diseño del portal, su código fuente, logotipos, marcas y signos
            distintivos pertenecen al titular o a terceros que han autorizado su uso, y
            están protegidos por los derechos de propiedad intelectual e industrial. Las
            fotografías y datos de negocios procedentes de terceros (por ejemplo, Google)
            se muestran con su correspondiente atribución.
          </p>

          <h2>5. Responsabilidad</h2>
          <p>
            La información de negocios y eventos puede proceder de fuentes públicas y de
            los propios negocios; procuramos que sea correcta, pero no garantizamos que
            esté siempre completa o actualizada. Jaén Guía no se responsabiliza de la
            legalidad ni de los contenidos de sitios de terceros enlazados desde el
            portal.
          </p>

          <h2>6. Legislación aplicable</h2>
          <p>
            Estas condiciones se rigen por la legislación española. Para cualquier
            controversia, las partes se someten a los juzgados y tribunales que
            correspondan conforme a la normativa aplicable.
          </p>
        </div>
      </main>
    </>
  );
}
