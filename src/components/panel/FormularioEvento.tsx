"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import BotonEnviar from "@/components/ui/BotonEnviar";
import { crearEventoNegocio } from "@/lib/actions/eventos";

interface Props {
  negocioId: string;
  slugNegocio: string;
  nombreNegocio: string;
  direccionNegocio: string | null;
  categoriaIdNegocio: string | null;
  categorias: { id: string; nombre: string }[];
  /** Server Action que recibe el formulario. Por defecto la del dueño;
   *  /admin pasa crearEventoComoAdmin. */
  accion?: (formData: FormData) => Promise<void>;
}

const CAMPO =
  "mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2.5 text-base outline-none focus:border-oliva-400";
const ETIQUETA = "block text-base font-medium text-oliva-700";

export default function FormularioEvento({
  negocioId,
  slugNegocio,
  nombreNegocio,
  direccionNegocio,
  categoriaIdNegocio,
  categorias,
  accion = crearEventoNegocio,
}: Props) {
  // Deciden qué input de fecha se envía (date vs datetime-local) y si hay
  // precio, así que el formulario tiene que ser cliente.
  const [todoElDia, setTodoElDia] = useState(false);
  const [gratis, setGratis] = useState(false);

  const tipoFecha = todoElDia ? "date" : "datetime-local";

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="negocio_id" value={negocioId} />
      <input type="hidden" name="slug_negocio" value={slugNegocio} />

      <div>
        <label htmlFor="titulo" className={ETIQUETA}>
          Qué pasa
        </label>
        <input
          id="titulo"
          name="titulo"
          type="text"
          required
          minLength={3}
          maxLength={120}
          placeholder="Ej. Música en directo con Los del Cerro"
          className={CAMPO}
        />
      </div>

      <label className="flex min-h-11 items-center gap-2.5 text-base text-oliva-700">
        <input
          type="checkbox"
          name="es_todo_el_dia"
          checked={todoElDia}
          onChange={(e) => setTodoElDia(e.target.checked)}
          className="h-5 w-5 accent-terracota-600"
        />
        Dura todo el día (ferias, exposiciones): no se muestra la hora
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fecha_inicio" className={ETIQUETA}>
            {todoElDia ? "Día" : "Día y hora"}
          </label>
          <input
            id="fecha_inicio"
            name="fecha_inicio"
            type={tipoFecha}
            required
            className={CAMPO}
          />
        </div>
        <div>
          <label htmlFor="fecha_fin" className={ETIQUETA}>
            Fin <span className="font-normal text-oliva-500">(opcional)</span>
          </label>
          <input id="fecha_fin" name="fecha_fin" type={tipoFecha} className={CAMPO} />
          <p className="mt-1 text-sm text-oliva-600">
            Solo si dura varios días. Si lo dejas vacío se entiende que acaba
            ese mismo día.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lugar_nombre" className={ETIQUETA}>
            Dónde
          </label>
          <input
            id="lugar_nombre"
            name="lugar_nombre"
            type="text"
            defaultValue={nombreNegocio}
            className={CAMPO}
          />
        </div>
        <div>
          <label htmlFor="direccion" className={ETIQUETA}>
            Dirección
          </label>
          <input
            id="direccion"
            name="direccion"
            type="text"
            defaultValue={direccionNegocio ?? ""}
            className={CAMPO}
          />
        </div>
      </div>

      <div>
        <label htmlFor="categoria_id" className={ETIQUETA}>
          Categoría
        </label>
        <select
          id="categoria_id"
          name="categoria_id"
          defaultValue={categoriaIdNegocio ?? ""}
          className={CAMPO}
        >
          <option value="">Sin categoría</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="descripcion" className={ETIQUETA}>
          Detalles <span className="font-normal text-oliva-500">(opcional)</span>
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={3}
          maxLength={600}
          placeholder="Reservas por teléfono, aforo limitado…"
          className={CAMPO}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
        <label className="flex min-h-11 items-center gap-2.5 text-base text-oliva-700">
          <input
            type="checkbox"
            name="es_gratis"
            checked={gratis}
            onChange={(e) => setGratis(e.target.checked)}
            className="h-5 w-5 accent-terracota-600"
          />
          Entrada gratuita
        </label>

        {!gratis && (
          <div>
            <label htmlFor="precio_texto" className={ETIQUETA}>
              Precio <span className="font-normal text-oliva-500">(opcional)</span>
            </label>
            <input
              id="precio_texto"
              name="precio_texto"
              type="text"
              maxLength={60}
              placeholder="10 € / 8 € anticipada"
              className={CAMPO}
            />
          </div>
        )}
      </div>

      <BotonEnviar
        textoEnviando="Publicando…"
        className="inline-flex min-h-11 items-center rounded-full bg-terracota-600 px-5 text-base font-semibold text-white hover:bg-terracota-700 transition-colors"
      >
        <CalendarPlus size={16} aria-hidden="true" />
        Publicar evento
      </BotonEnviar>
    </form>
  );
}
