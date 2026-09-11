
export const metadata = {
  title: "Política de Privacidad · Jaén Guía",
  robots: { index: false, follow: false },
};

export default function PrivacidadPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <h1 className="font-display text-4xl font-bold text-oliva-900 mb-8">
          Política de Privacidad
        </h1>
        <div className="texto-legal text-oliva-700">
          <p>
            En Jaén Guía estamos comprometidos con la protección de la privacidad
            y el uso correcto de los datos personales.
          </p>
          <h2>1. Recogida y tratamiento de datos</h2>
          <p>
            Los datos personales recogidos a través de los formularios de contacto y
            registro serán incorporados a nuestros ficheros con la finalidad de
            gestionar las solicitudes de los usuarios y proporcionar los servicios
            ofrecidos en el portal.
          </p>
          <h2>2. Derechos de los usuarios</h2>
          <p>
            Cualquier persona tiene derecho a obtener confirmación sobre si en Jaén Guía
            estamos tratando datos personales que les conciernan, o no. Las personas
            interesadas tienen derecho a acceder a sus datos personales, así como a
            solicitar la rectificación de los datos inexactos o, en su caso, solicitar
            su supresión.
          </p>
          <h2>3. Cookies</h2>
          <p>
            Este sitio web puede utilizar cookies técnicas estrictamente necesarias
            para el funcionamiento del portal. No utilizamos cookies de rastreo o
            publicidad de terceros sin consentimiento previo.
          </p>
        </div>
      </main>
    </>
  );
}
