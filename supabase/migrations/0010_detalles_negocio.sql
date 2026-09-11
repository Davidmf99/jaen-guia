-- =========================================================
-- JAÉN GUÍA · 0010: detalles del negocio para la ficha
--
-- Hasta ahora la ficha solo tenía descripción, dirección, teléfono,
-- web y horario. Para un bar o restaurante eso se queda corto: falta
-- lo que la gente mira antes de ir (precio orientativo, tipo de
-- cocina, si hay terraza, si se puede reservar, si aceptan perros...).
--
-- Los arrays son de texto libre a propósito para no tener que migrar
-- cada vez que aparezca un servicio nuevo. Las claves conocidas de
-- `servicios` (con su etiqueta e icono) viven en src/lib/servicios.ts;
-- una clave desconocida simplemente no se pinta.
-- =========================================================

alter table negocios
  add column rango_precio text check (rango_precio in ('€', '€€', '€€€', '€€€€')),
  add column tipo_cocina text[] not null default '{}',
  add column especialidades text[] not null default '{}',
  add column servicios text[] not null default '{}',
  add column email text,
  add column instagram text;

comment on column negocios.rango_precio is
  'Precio orientativo por persona en 4 tramos (€ barato … €€€€ caro). Se rellena desde Google Places (priceLevel) o desde el panel del dueño.';

comment on column negocios.tipo_cocina is
  'Etiquetas libres tipo "Tapas", "Cocina jiennense", "Asador". Se muestran como chips en la ficha.';

comment on column negocios.especialidades is
  'Platos o productos estrella ("Ochíos", "Andrajos", "Aceite picual ecológico"). Texto libre, uno por elemento.';

comment on column negocios.servicios is
  'Claves de servicio: terraza, reservas, para_llevar, a_domicilio, accesible, wifi, mascotas, ninos, menu_dia, vegetariano, vegano, sin_gluten, parking, tarjeta, desayunos, comidas, cenas, cocteles, vino, grupos. Catálogo en src/lib/servicios.ts.';

comment on column negocios.instagram is
  'Usuario de Instagram sin @ ni URL (p. ej. "panaceite"). La ficha construye el enlace.';
