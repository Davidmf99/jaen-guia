-- JAÉN GUÍA · 0020: normaliza_texto vuelve a ser completa
--
-- 0007 redefinió normaliza_texto para la búsqueda sin tildes, pero con
-- una versión más pobre que la de 0006: sin ñ→n, sin quitar signos ni
-- colapsar espacios. Como el trigger de slug de eventos y la huella de
-- deduplicación usan la misma función, desde entonces los eventos
-- leídos de redes salían con slugs como
--   "campaña-avanzar-en-conciliacion-…", "san-lucas-&-roll-2026-…",
--   "resonancias-iberas:-equinoccio-de-otoño-…"
-- Se restaura la versión completa (misma firma, para no tocar índices
-- ni la columna generada) y se corrigen los slugs ya guardados.

create or replace function public.normaliza_texto(txt text)
returns text
language plpgsql
immutable
as $$
begin
  return btrim(
    regexp_replace(
      lower(translate(
        txt,
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
      )),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
end;
$$;

-- Slugs de eventos con caracteres fuera de [a-z0-9-]: se regeneran con
-- la misma regla del trigger (título normalizado + 8 del id).
update eventos
   set slug = btrim(left(replace(public.normaliza_texto(titulo), ' ', '-'), 60), '-')
              || '-' || left(replace(id::text, '-', ''), 8)
 where slug ~ '[^a-z0-9-]';

-- La columna generada de negocios no se recalcula al cambiar la
-- función: se vuelve a crear, como hizo 0007.
drop index if exists idx_negocios_nombre_normalizado;
alter table negocios drop column if exists nombre_normalizado;
alter table negocios add column nombre_normalizado text generated always as (public.normaliza_texto(nombre::text)) stored;
create index idx_negocios_nombre_normalizado on negocios(nombre_normalizado);
