-- =========================================================
-- JAÉN GUÍA · 0005: foto dinámica desde Google Places
--
-- No guardamos la imagen de Google de forma permanente (sus
-- condiciones de uso no lo permiten): solo el "name" del recurso de
-- foto de Places API (New), que se resuelve en el momento contra la
-- Photo Media API desde /api/foto-negocio/[id] (ver esa ruta). La
-- atribución se guarda para poder mostrarla junto a la imagen, tal y
-- como exige Google cuando la proporciona.
--
-- google_place_id permite además volver a localizar un negocio ya
-- importado en Places API (p. ej. para el backfill de fotos de los
-- negocios que se importaron antes de que existiera esta columna).
-- =========================================================

alter table negocios
  add column google_place_id text unique,
  add column google_photo_name text,
  add column google_photo_atribucion text;

comment on column negocios.google_place_id is
  'places/{PLACE_ID} o el id de Google Places (New) para este negocio, si se importó desde ahí. Sirve para volver a consultar Places API sin re-buscar por texto.';

comment on column negocios.google_photo_name is
  'Resource name de la primera foto de Google Places (New), tipo "places/XXX/photos/YYY". NO es una URL: se resuelve en cada petición contra la Photo Media API desde /api/foto-negocio/[id]. No se descarga ni se guarda la imagen en sí.';

comment on column negocios.google_photo_atribucion is
  'authorAttributions[0].displayName de la foto de Google, si Google lo proporciona. Se muestra superpuesto en la imagen cuando existe, tal y como exigen las condiciones de uso de Google Places.';
