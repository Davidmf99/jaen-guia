// Estado del formulario de registro. Vive fuera de `auth.ts` porque un fichero
// con "use server" solo puede exportar funciones asíncronas.
import type { CamposRegistro, ErroresRegistro } from "@/lib/validaciones/registro";

export interface EstadoRegistro {
  errores: ErroresRegistro;
  mensaje: string | null;
  exito: boolean;
  /** Se devuelven para repoblar el formulario si el navegador no tiene JS. */
  valores: Omit<CamposRegistro, "password" | "confirmPassword">;
}

export const ESTADO_REGISTRO_INICIAL: EstadoRegistro = {
  errores: {},
  mensaje: null,
  exito: false,
  valores: {
    nombre: "",
    apellidos: "",
    username: "",
    email: "",
    aceptaTerminos: false,
  },
};
