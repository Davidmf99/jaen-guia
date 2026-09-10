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
}

const CAMPO =
  "mt-1 w-full rounded-xl border border-oliva-100 px-3 py-2 text-sm outline-none focus:border-oliva-400";
const ETIQUETA = "text-sm font-medium text-oliva-700";

export default function FormularioEvento({
  negocioId,
  slugNegocio,
  nombreNegocio,
  direccionNegocio,
  categoriaIdNegocio,
  categorias,
}: Props) {
  // Deciden qué input de fecha se envía (date vs datetime-local) y si hay
  // precio, así que el formulario tiene que ser cliente.
  const [todoElDia, setTodoElDia] = useState(false);
  const [gratis, setGratis] = useState(false);

  const tipoFecha = todoElDia ? "date" : "datetime-local";

  return (
    <form action={crearEventoNegocio} className="space-y-4">
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

      <label className="flex items-center gap-2 text-sm text-oliva-700">
        <input
          type="checkbox"
          name="es_todo_el_dia"
          checked={todoElDia}
          onChange={(e) => setTodoElDia(e.target.checked)}
          className="h-4 w-4 accent-terracota-500"
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
          <p className="mt-1 text-xs text-oliva-600">
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
          Sección
        </label>
        <select
          id="categoria_id"
          name="categoria_id"
          defaultValue={categoriaIdNegocio ?? ""}
          className={CAMPO}
        >
          <option value="">Sin sección</option>
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
        <label className="flex items-center gap-2 text-sm text-oliva-700">
          <input
            type="checkbox"
            name="es_gratis"
            checked={gratis}
            onChange={(e) => setGratis(e.target.checked)}
            className="h-4 w-4 accent-terracota-500"
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
        className="rounded-full bg-terracota-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-terracota-600 transition-colors"
      >
        <CalendarPlus size={16} aria-hidden="true" />
        Publicar evento
      </BotonEnviar>
    </form>
  );
}
