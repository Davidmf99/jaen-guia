-- =========================================================
-- JAÉN GUÍA · 0002: zona/barrio en negocios
-- Campo opcional para filtrar por zona dentro de Jaén capital.
-- Texto libre por ahora (sin CHECK): más adelante, si hace falta,
-- se puede restringir a una lista fija de valores.
-- =========================================================

alter table negocios
  add column zona text;

comment on column negocios.zona is
  'Zona/barrio dentro del municipio. Valores orientativos para Jaén '
  'capital: Centro, Bulevar, Los Cerros, La Alcantarilla, El Valle. '
  'Texto libre, sin restricción por CHECK todavía.';
