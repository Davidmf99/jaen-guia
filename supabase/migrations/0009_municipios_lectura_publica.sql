-- =========================================================
-- JAÉN GUÍA · 0009: lectura pública de municipios (de nuevo)
--
-- 0004 ya creaba esta policy, pero en la base de datos remota
-- no está: `select` sobre municipios con la clave anónima
-- devuelve 0 filas mientras que categorias (creada en la misma
-- migración) sí funciona, así que 0004 se aplicó a medias.
--
-- Sin esta policy, el filtro de "solo Jaén capital" de la home
-- y de /eventos no puede resolver cuál es la capital y acaba
-- listando también los eventos de la provincia.
--
-- Escrita para poder ejecutarse las veces que haga falta.
-- =========================================================

alter table municipios enable row level security;

drop policy if exists "Municipios visibles para todos" on municipios;

create policy "Municipios visibles para todos"
  on municipios for select
  using (true);
