
export const metadata = {
  title: "Contacto · Jaén Guía",
};

export default function ContactoPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <h1 className="font-display text-4xl font-bold text-oliva-900 mb-6">
          Contacto
        </h1>
        <div className="prose prose-oliva text-oliva-700 mb-12">
          <p className="text-lg">
            ¿Tienes alguna duda, sugerencia o quieres que tu negocio aparezca en
            Jaén Guía? Escríbenos y nos pondremos en contacto contigo lo antes
            posible.
          </p>
        </div>
        
        <div className="rounded-2xl border border-oliva-100 bg-tierra-50 p-8">
          <h2 className="font-display text-2xl font-semibold text-oliva-900 mb-4">
            Escríbenos
          </h2>
          <p className="text-oliva-700 mb-6">
            Puedes ponerte en contacto con nosotros a través de nuestro correo
            electrónico:
          </p>
          <a
            href="mailto:hola@jaenguia.com"
            className="inline-flex items-center justify-center rounded-full bg-terracota-500 px-6 py-3 text-base font-semibold text-white hover:bg-terracota-600 transition-colors"
          >
            hola@jaenguia.com
          </a>
        </div>
      </main>
    </>
  );
}
