
export const metadata = {
  title: "Aviso Legal · Jaén Guía",
  robots: { index: false, follow: false },
};

export default function AvisoLegalPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <h1 className="font-display text-4xl font-bold text-oliva-900 mb-8">
          Aviso Legal
        </h1>
        <div className="texto-legal text-oliva-700">
          <p>
            En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de
            Servicios de la Sociedad de la Información y Comercio Electrónico (LSSICE),
            se exponen a continuación los datos identificativos del titular de este
            sitio web.
          </p>
          <h2>1. Información general</h2>
          <p>
            Jaén Guía es un directorio digital de gastronomía, cultura y ocio de
            la provincia de Jaén.
          </p>
          <h2>2. Propiedad intelectual e industrial</h2>
          <p>
            El diseño del portal y sus códigos fuente, así como los logos, marcas
            y demás signos distintivos que aparecen en el mismo pertenecen a Jaén Guía
            y están protegidos por los correspondientes derechos de propiedad
            intelectual e industrial.
          </p>
          <h2>3. Responsabilidad de los contenidos</h2>
          <p>
            Jaén Guía no se hace responsable de la legalidad de otros sitios web
            de terceros desde los que pueda accederse al portal. Jaén Guía tampoco
            responde por la legalidad de otros sitios web de terceros, que pudieran
            estar vinculados o enlazados desde este portal.
          </p>
        </div>
      </main>
    </>
  );
}
