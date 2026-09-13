// Genera los correos de Supabase Auth (confirmar cuenta, recuperar
// contraseña, cambiar email) con la misma plantilla que los de la app,
// y los deja en supabase/templates/ para pegarlos en el panel:
// Authentication → Email Templates. Se ejecuta con:
//   npx tsx scripts/generar-plantillas-auth.mts
//
// Las variables {{ .ConfirmationURL }}, {{ .Data.nombre }}, etc. las
// rellena Supabase (plantillas Go). Se dejan tal cual en el HTML.

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
// "server-only" lanza fuera de Next; aquí no hay servidor que proteger.
const soloServidor = require.resolve("server-only");
require.cache[soloServidor] = { id: soloServidor, filename: soloServidor, loaded: true, exports: {} } as NodeJS.Module;
process.env.NEXT_PUBLIC_SITE_URL = "{{ .SiteURL }}";

const { correo } = await import("../src/lib/email/plantilla");

const saludo = "{{ if .Data.nombre }}Hola, <strong>{{ .Data.nombre }}</strong>.{{ else }}Hola.{{ end }}";

const plantillas = {
  "confirmar-cuenta": {
    asunto: "Confirma tu cuenta en Jaén Guía",
    correo: correo({
      asunto: "Confirma tu cuenta en Jaén Guía",
      resumen: "Un toque y ya estás dentro.",
      titulo: "Confirma tu correo",
      parrafos: [
        `${saludo} Gracias por registrarte en Jaén Guía, la guía de bares, restaurantes y planes de Jaén. Solo falta confirmar que este correo es tuyo.`,
      ],
      boton: { texto: "Confirmar mi cuenta", url: "{{ .ConfirmationURL }}" },
      notas: [
        "El enlace caduca en 24 horas y solo funciona una vez.",
        "Si no has creado ninguna cuenta en Jaén Guía, ignora este correo: no se creará nada.",
      ],
      motivo: "Recibes este correo porque alguien ha usado esta dirección para registrarse en Jaén Guía.",
    }),
  },
  "recuperar-contrasena": {
    asunto: "Recupera tu contraseña de Jaén Guía",
    correo: correo({
      asunto: "Recupera tu contraseña de Jaén Guía",
      resumen: "Elige una contraseña nueva con este enlace.",
      titulo: "Cambia tu contraseña",
      parrafos: [
        `${saludo} Nos has pedido recuperar el acceso a tu cuenta de Jaén Guía. Con este enlace eliges una contraseña nueva; la anterior deja de valer en cuanto la cambies.`,
      ],
      boton: { texto: "Elegir contraseña nueva", url: "{{ .ConfirmationURL }}" },
      notas: [
        "El enlace caduca en 1 hora y solo funciona una vez. Si ya no sirve, pide otro desde la web.",
        "Si no has sido tú, no hace falta que hagas nada: tu contraseña sigue igual.",
      ],
      motivo: "Recibes este correo porque alguien ha pedido recuperar la contraseña de la cuenta de Jaén Guía asociada a esta dirección.",
    }),
  },
  "cambiar-email": {
    asunto: "Confirma tu nuevo correo en Jaén Guía",
    correo: correo({
      asunto: "Confirma tu nuevo correo en Jaén Guía",
      resumen: "Confirma que quieres usar {{ .NewEmail }}.",
      titulo: "Confirma el cambio de correo",
      parrafos: [
        `${saludo} Has pedido cambiar el correo de tu cuenta de Jaén Guía de <strong>{{ .Email }}</strong> a <strong>{{ .NewEmail }}</strong>. Confírmalo desde la dirección nueva.`,
      ],
      boton: { texto: "Confirmar el nuevo correo", url: "{{ .ConfirmationURL }}" },
      notas: ["Si no has pedido este cambio, ignora este correo y tu cuenta seguirá con el correo de siempre."],
      motivo: "Recibes este correo porque se ha pedido cambiar el correo de una cuenta de Jaén Guía a esta dirección.",
    }),
  },
};

const carpeta = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "templates");
for (const [nombre, p] of Object.entries(plantillas)) {
  writeFileSync(join(carpeta, `${nombre}.html`), p.correo.html);
  console.log(`${nombre}.html  →  asunto: ${p.asunto}`);
}
