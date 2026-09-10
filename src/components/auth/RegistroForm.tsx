"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  X,
} from "lucide-react";
import { comprobarUsername, registrarUsuario } from "@/lib/actions/auth";
import {
  ESTADO_REGISTRO_INICIAL,
  type EstadoRegistro,
} from "@/lib/actions/auth-estado";
import {
  fuerzaPassword,
  normalizarUsername,
  requisitosPassword,
  validarApellidos,
  validarConfirmacion,
  validarEmail,
  validarNombre,
  validarPassword,
  validarUsername,
  type CampoRegistro,
  type CamposRegistro,
} from "@/lib/validaciones/registro";

const INPUT_BASE =
  "w-full rounded-2xl border bg-tierra-50 px-4 py-3 text-base text-oliva-900 outline-none transition-all focus:bg-white";
const INPUT_OK = "border-oliva-100 focus:border-terracota-400";
const INPUT_ERROR = "border-red-400 bg-red-50/60 focus:border-red-500";
const LABEL =
  "text-sm font-bold tracking-wide uppercase text-terracota-600 mb-2 block";

const COLORES_FUERZA = [
  "bg-red-400",
  "bg-red-400",
  "bg-amber-400",
  "bg-oliva-400",
  "bg-oliva-600",
];

function MensajeError({ id, texto }: { id: string; texto?: string }) {
  if (!texto) return null;
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-red-600"
    >
      <AlertCircle size={14} aria-hidden="true" className="mt-px shrink-0" />
      {texto}
    </p>
  );
}

function Requisito({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <li
      className={`flex items-center gap-1.5 text-xs font-medium ${
        ok ? "text-oliva-600" : "text-oliva-400"
      }`}
    >
      {ok ? (
        <Check size={13} aria-hidden="true" />
      ) : (
        <X size={13} aria-hidden="true" />
      )}
      {texto}
    </li>
  );
}

export default function RegistroForm() {
  const [estado, formAction, enviando] = useActionState<EstadoRegistro, FormData>(
    registrarUsuario,
    ESTADO_REGISTRO_INICIAL
  );

  const [valores, setValores] = useState<CamposRegistro>(() => ({
    ...estado.valores,
    password: "",
    confirmPassword: "",
  }));
  const [tocados, setTocados] = useState<Partial<Record<CampoRegistro, boolean>>>({});
  // Campos editados después del último envío: su error de servidor ya no vale.
  // Se guarda junto al estado que los originó para que un envío nuevo los limpie
  // sin necesidad de un efecto.
  const [edicion, setEdicion] = useState<{
    estado: EstadoRegistro;
    campos: Partial<Record<CampoRegistro, boolean>>;
  }>({ estado, campos: {} });
  const editadosTrasEnvio = edicion.estado === estado ? edicion.campos : {};
  const [verPassword, setVerPassword] = useState(false);
  const [verConfirm, setVerConfirm] = useState(false);
  const [consultaUsername, setConsultaUsername] = useState<{
    usuario: string;
    disponible: boolean;
  } | null>(null);
  const [comprobando, iniciarComprobacion] = useTransition();
  const resumenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (estado.mensaje) resumenRef.current?.focus();
  }, [estado]);

  const usuarioNormalizado = normalizarUsername(valores.username);
  const usernameLibre =
    consultaUsername && consultaUsername.usuario === usuarioNormalizado
      ? consultaUsername.disponible
      : null;

  const contexto = {
    username: valores.username,
    email: valores.email,
    nombre: valores.nombre,
    apellidos: valores.apellidos,
  };

  const erroresCliente: Partial<Record<CampoRegistro, string | null>> = {
    nombre: validarNombre(valores.nombre),
    apellidos: validarApellidos(valores.apellidos),
    username: validarUsername(valores.username),
    email: validarEmail(valores.email),
    password: validarPassword(valores.password, contexto),
    confirmPassword: validarConfirmacion(valores.password, valores.confirmPassword),
    aceptaTerminos: valores.aceptaTerminos ? null : "Tienes que aceptar las condiciones.",
  };

  if (!erroresCliente.username && usernameLibre === false) {
    erroresCliente.username = "Ese nombre de usuario ya está en uso.";
  }

  function errorDe(campo: CampoRegistro): string | undefined {
    if (tocados[campo] && erroresCliente[campo]) return erroresCliente[campo]!;
    if (!editadosTrasEnvio[campo]) return estado.errores[campo];
    return undefined;
  }

  function cambiar(campo: CampoRegistro, valor: string | boolean) {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    setEdicion((previa) =>
      previa.estado === estado
        ? { estado, campos: { ...previa.campos, [campo]: true } }
        : { estado, campos: { [campo]: true } }
    );
  }

  function marcarTocado(campo: CampoRegistro) {
    setTocados((previos) => ({ ...previos, [campo]: true }));
  }

  // Disponibilidad del usuario: se consulta al parar de escribir.
  useEffect(() => {
    if (validarUsername(usuarioNormalizado)) return;

    const temporizador = setTimeout(() => {
      iniciarComprobacion(async () => {
        const { disponible } = await comprobarUsername(usuarioNormalizado);
        setConsultaUsername({ usuario: usuarioNormalizado, disponible });
      });
    }, 450);

    return () => clearTimeout(temporizador);
  }, [usuarioNormalizado]);

  const requisitos = requisitosPassword(valores.password);
  const fuerza = fuerzaPassword(valores.password, contexto);
  const passwordsCoinciden =
    valores.confirmPassword.length > 0 && valores.password === valores.confirmPassword;
  const hayErrores = Object.values(erroresCliente).some(Boolean);

  function clase(campo: CampoRegistro) {
    return `${INPUT_BASE} ${errorDe(campo) ? INPUT_ERROR : INPUT_OK}`;
  }

  function descripcion(campo: CampoRegistro) {
    return errorDe(campo) ? `${campo}-error` : undefined;
  }

  if (estado.exito) {
    return (
      <div
        ref={resumenRef}
        tabIndex={-1}
        className="w-full max-w-lg rounded-[2rem] bg-white p-8 md:p-10 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-oliva-100 outline-none"
      >
        <MailCheck
          size={40}
          aria-hidden="true"
          className="mx-auto mb-4 text-terracota-500"
        />
        <h2 className="font-display text-3xl text-oliva-900 mb-3">Ya casi está.</h2>
        <p className="text-oliva-700">{estado.mensaje}</p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-full bg-oliva-900 px-6 py-3 text-sm font-bold text-white hover:bg-terracota-600 transition-colors"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-oliva-100">
      <form action={formAction} noValidate className="space-y-5">
        {/* Trampa para bots: invisible y fuera del recorrido de teclado. */}
        <input
          type="text"
          name="web"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="nombre" className={LABEL}>
              Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              autoComplete="given-name"
              maxLength={40}
              required
              value={valores.nombre}
              onChange={(e) => cambiar("nombre", e.target.value)}
              onBlur={() => marcarTocado("nombre")}
              aria-invalid={Boolean(errorDe("nombre"))}
              aria-describedby={descripcion("nombre")}
              className={clase("nombre")}
            />
            <MensajeError id="nombre-error" texto={errorDe("nombre")} />
          </div>
          <div>
            <label htmlFor="apellidos" className={LABEL}>
              Apellidos
            </label>
            <input
              id="apellidos"
              name="apellidos"
              type="text"
              autoComplete="family-name"
              maxLength={60}
              required
              value={valores.apellidos}
              onChange={(e) => cambiar("apellidos", e.target.value)}
              onBlur={() => marcarTocado("apellidos")}
              aria-invalid={Boolean(errorDe("apellidos"))}
              aria-describedby={descripcion("apellidos")}
              className={clase("apellidos")}
            />
            <MensajeError id="apellidos-error" texto={errorDe("apellidos")} />
          </div>
        </div>

        <div>
          <label htmlFor="username" className={LABEL}>
            Nombre de usuario
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-4 flex items-center text-oliva-400 font-bold">
              @
            </span>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="ej. juan_jaen"
              maxLength={20}
              required
              value={valores.username}
              onChange={(e) => cambiar("username", normalizarUsername(e.target.value))}
              onBlur={() => marcarTocado("username")}
              aria-invalid={Boolean(errorDe("username"))}
              aria-describedby={descripcion("username")}
              className={`${clase("username")} pl-10 pr-10`}
            />
            <span className="absolute inset-y-0 right-4 flex items-center">
              {comprobando && (
                <Loader2
                  size={16}
                  aria-hidden="true"
                  className="animate-spin text-oliva-400"
                />
              )}
              {!comprobando && usernameLibre === true && (
                <Check size={16} aria-hidden="true" className="text-oliva-600" />
              )}
            </span>
          </div>
          {!errorDe("username") && usernameLibre === true && (
            <p className="mt-1.5 text-xs font-semibold text-oliva-600">
              @{valores.username} está libre.
            </p>
          )}
          <MensajeError id="username-error" texto={errorDe("username")} />
        </div>

        <div>
          <label htmlFor="email" className={LABEL}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            required
            value={valores.email}
            onChange={(e) => cambiar("email", e.target.value)}
            onBlur={() => marcarTocado("email")}
            aria-invalid={Boolean(errorDe("email"))}
            aria-describedby={descripcion("email")}
            className={clase("email")}
          />
          <MensajeError id="email-error" texto={errorDe("email")} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="password" className={LABEL}>
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={verPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={valores.password}
                onChange={(e) => cambiar("password", e.target.value)}
                onBlur={() => marcarTocado("password")}
                aria-invalid={Boolean(errorDe("password"))}
                aria-describedby="password-requisitos password-error"
                className={`${clase("password")} pr-11`}
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-3 flex items-center text-oliva-400 hover:text-oliva-700 transition-colors"
              >
                {verPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <MensajeError id="password-error" texto={errorDe("password")} />
          </div>
          <div>
            <label htmlFor="confirmPassword" className={LABEL}>
              Repetir
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={verConfirm ? "text" : "password"}
                autoComplete="new-password"
                required
                value={valores.confirmPassword}
                onChange={(e) => cambiar("confirmPassword", e.target.value)}
                onBlur={() => marcarTocado("confirmPassword")}
                aria-invalid={Boolean(errorDe("confirmPassword"))}
                aria-describedby={descripcion("confirmPassword")}
                className={`${clase("confirmPassword")} pr-11`}
              />
              <button
                type="button"
                onClick={() => setVerConfirm((v) => !v)}
                aria-label={verConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-3 flex items-center text-oliva-400 hover:text-oliva-700 transition-colors"
              >
                {verConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {passwordsCoinciden && !errorDe("confirmPassword") && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-oliva-600">
                <Check size={13} aria-hidden="true" />
                Coinciden.
              </p>
            )}
            <MensajeError id="confirmPassword-error" texto={errorDe("confirmPassword")} />
          </div>
        </div>

        {valores.password.length > 0 && (
          <div id="password-requisitos" className="rounded-2xl bg-tierra-50 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex-1 flex gap-1"
                role="meter"
                aria-label="Seguridad de la contraseña"
                aria-valuenow={fuerza.puntos}
                aria-valuemin={0}
                aria-valuemax={4}
                aria-valuetext={fuerza.etiqueta}
              >
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i < fuerza.puntos ? COLORES_FUERZA[fuerza.puntos] : "bg-oliva-100"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-oliva-700">{fuerza.etiqueta}</span>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <Requisito ok={requisitos.longitud} texto="8 caracteres o más" />
              <Requisito ok={requisitos.mayuscula} texto="Una mayúscula" />
              <Requisito ok={requisitos.minuscula} texto="Una minúscula" />
              <Requisito ok={requisitos.numero} texto="Un número" />
              <Requisito ok={requisitos.simbolo} texto="Un símbolo (opcional)" />
            </ul>
          </div>
        )}

        <div className="pt-1 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                name="es_de_jaen"
                className="peer sr-only"
              />
              <div className="w-5 h-5 rounded border border-oliva-100 bg-tierra-50 peer-checked:bg-terracota-500 peer-checked:border-terracota-500 transition-colors" />
              <svg
                className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-oliva-900 group-hover:text-terracota-600 transition-colors">
                Soy residente de la provincia de Jaén
              </span>
              <span className="text-xs text-oliva-500">
                Nos ayuda a destacar las reseñas de los locales.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                name="acepta_terminos"
                className="peer sr-only"
                checked={valores.aceptaTerminos}
                onChange={(e) => cambiar("aceptaTerminos", e.target.checked)}
                onBlur={() => marcarTocado("aceptaTerminos")}
                aria-invalid={Boolean(errorDe("aceptaTerminos"))}
                aria-describedby={descripcion("aceptaTerminos")}
              />
              <div
                className={`w-5 h-5 rounded border bg-tierra-50 peer-checked:bg-terracota-500 peer-checked:border-terracota-500 transition-colors ${
                  errorDe("aceptaTerminos") ? "border-red-400" : "border-oliva-100"
                }`}
              />
              <svg
                className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm font-medium text-oliva-900">
              Acepto el{" "}
              <Link
                href="/aviso-legal"
                className="font-bold text-terracota-600 hover:text-terracota-500 underline"
              >
                aviso legal
              </Link>{" "}
              y la{" "}
              <Link
                href="/privacidad"
                className="font-bold text-terracota-600 hover:text-terracota-500 underline"
              >
                política de privacidad
              </Link>
              .
            </span>
          </label>
          <MensajeError id="aceptaTerminos-error" texto={errorDe("aceptaTerminos")} />
        </div>

        {(estado.errores.form || (estado.mensaje && !estado.exito)) && (
          <div
            ref={resumenRef}
            tabIndex={-1}
            role="alert"
            className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 outline-none"
          >
            <p className="text-sm font-semibold text-red-600 text-center">
              {estado.errores.form ?? "Revisa los campos marcados."}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={enviando}
          onClick={() =>
            setTocados({
              nombre: true,
              apellidos: true,
              username: true,
              email: true,
              password: true,
              confirmPassword: true,
              aceptaTerminos: true,
            })
          }
          aria-disabled={hayErrores}
          className="mt-6 w-full rounded-full bg-oliva-900 px-4 py-3.5 text-sm font-bold text-white hover:bg-terracota-600 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {enviando && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
          {enviando ? "Creando cuenta…" : "Comenzar a explorar"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm font-medium text-oliva-600">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/login"
          className="font-bold text-terracota-600 hover:text-terracota-500 transition-colors"
        >
          Inicia sesión aquí
        </Link>
      </p>
    </div>
  );
}
