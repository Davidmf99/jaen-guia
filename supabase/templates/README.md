# Correos de Supabase Auth

Los tres correos que manda Supabase (no la app): confirmar cuenta,
recuperar contraseña y cambiar email. Se generan con

    npx tsx scripts/generar-plantillas-auth.mts

a partir de la misma plantilla que los correos de la app
(`src/lib/email/plantilla.ts`), y hay que pegarlos a mano en el panel de
Supabase. No se editan estos HTML directamente: se cambia el script y se
vuelve a generar.

## Dónde se pegan

Panel de Supabase → Authentication → Emails → Templates:

| Pestaña de Supabase   | Archivo                    | Asunto                                  |
|-----------------------|----------------------------|-----------------------------------------|
| Confirm sign up       | `confirmar-cuenta.html`    | Confirma tu cuenta en Jaén Guía         |
| Reset password        | `recuperar-contrasena.html`| Recupera tu contraseña de Jaén Guía     |
| Change email address  | `cambiar-email.html`       | Confirma tu nuevo correo en Jaén Guía   |

Magic link, Invite user y Reauthentication no se usan: la app entra con
contraseña y no invita a nadie.

## SMTP (para que salgan desde hola@jaenguia.com)

Authentication → Emails → SMTP Settings → Enable custom SMTP:

- Sender email: `hola@jaenguia.com` · Sender name: `Jaén Guía`
- Host: `smtp.resend.com` · Port: `465`
- Username: `resend` · Password: la API key de Resend (`re_…`)

Sin SMTP propio, Supabase manda desde `noreply@mail.app.supabase.io` y
limita a unos pocos correos por hora.

## URLs

Authentication → URL Configuration:

- Site URL: `https://jaenguia.com`
- Redirect URLs: `https://jaenguia.com/auth/callback**` y
  `http://localhost:3000/auth/callback**` (el `**` es por el `?siguiente=`).

El enlace de confirmar cuenta aterriza en `/auth/callback?bienvenida=1`,
que manda el correo de bienvenida de la app (`correoBienvenida`).
