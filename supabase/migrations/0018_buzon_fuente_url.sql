-- JAÉN GUÍA · 0018: buzon_mensajes.fuente_url
--
-- El permalink del post original solo vivía en el evento generado.
-- Para reprocesar un mensaje ya guardado con un prompt nuevo (sin
-- volver a leer Instagram) hace falta conservarlo en el propio mensaje:
-- si la lectura anterior dijo "no es evento", no hay evento del que
-- recuperarlo.

alter table buzon_mensajes add column if not exists fuente_url text;

comment on column buzon_mensajes.fuente_url is
  'Permalink del post original (Instagram/Facebook). Alimenta eventos.fuente_url al (re)procesar.';

-- Rellenar lo que ya hay a partir de los eventos enlazados.
update buzon_mensajes b
   set fuente_url = e.fuente_url
  from eventos e
 where b.evento_id = e.id
   and b.fuente_url is null
   and e.fuente_url is not null;
