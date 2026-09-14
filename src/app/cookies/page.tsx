export const metadata = {
  title: "Política de Cookies · Jaén Guía",
  robots: { index: false, follow: false },
};

export default function CookiesPage() {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <h1 className="font-display text-4xl font-bold text-oliva-900 mb-2">
          Política de Cookies
        </h1>
        <p className="text-sm text-oliva-500 mb-8">Última actualización: 14 de septiembre de 2026</p>

        <div className="texto-legal text-oliva-700 space-y-4">
          <p>
            Una cookie es un pequeño archivo que un sitio guarda en tu navegador. Jaén
            Guía utiliza <strong>únicamente cookies técnicas estrictamente necesarias</strong>{" "}
            para que el sitio funcione.
          </p>

          <h2>1. Cookies que usamos</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Sesión de usuario</strong> (Supabase Auth): mantienen tu sesión
              iniciada cuando entras en tu cuenta. Sin ellas no podrías permanecer
              identificado.
            </li>
          </ul>
          <p>
            Estas cookies son imprescindibles para prestar el servicio que solicitas, por
            lo que, conforme a la normativa vigente, <strong>no requieren consentimiento</strong>{" "}
            previo. No usamos cookies de analítica, de publicidad ni de seguimiento de
            terceros.
          </p>

          <h2>2. Gestión de cookies</h2>
          <p>
            Puedes borrar o bloquear las cookies desde la configuración de tu navegador,
            pero si desactivas las técnicas es posible que no puedas iniciar sesión ni
            usar las funciones que requieren cuenta.
          </p>

          <h2>3. Cambios</h2>
          <p>
            Si en el futuro incorporamos cookies de analítica o de terceros, actualizaremos
            esta política y solicitaremos tu consentimiento mediante un aviso de cookies
            antes de instalarlas.
          </p>
        </div>
      </main>
    </>
  );
}
