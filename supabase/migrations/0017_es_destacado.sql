-- =========================================================
-- JAÉN GUÍA · 0017: un solo criterio de "destacado"
--
-- Hasta ahora portada, /destacados y el orden de las categorías
-- miraban negocios.destacado (selección editorial a mano) y el plan
-- de pago (negocios.plan, 0016) no influía. es_destacado une los dos:
-- editorial O suscripción activa. Las consultas usan esta columna;
-- el webhook de Stripe solo toca plan y el admin solo destacado.
-- =========================================================

alter table negocios
  add column if not exists es_destacado boolean
    generated always as (destacado or plan = 'destacado') stored;

comment on column negocios.es_destacado is
  'destacado (editorial) OR plan = ''destacado'' (pagado). Es lo que consultan portada, /destacados y el orden por categoría.';

drop index if exists idx_negocios_destacado;
create index idx_negocios_es_destacado on negocios (es_destacado) where es_destacado = true;
