-- =========================================================
-- JAÉN GUÍA · 0004: lectura pública de categorias y municipios
--
-- categorias y municipios se quedaron en algún momento con RLS
-- activada (probablemente desde el dashboard/SQL Editor) pero sin
-- ninguna policy de SELECT, así que con la clave anon (la que usa la
-- app en el server) devolvían siempre [] sin error. Como negocios se
-- filtra con categoria:categorias!inner(...), esto rompía en
-- silencio /gastronomia, /cultura, /naturaleza, /tiendas,
-- /experiencias y el menú del Header para todo el mundo, no solo
-- para los negocios importados por el script.
-- =========================================================

alter table categorias enable row level security;
alter table municipios enable row level security;

create policy "Categorias visibles para todos" on categorias for select using (true);
create policy "Municipios visibles para todos" on municipios for select using (true);
