-- =========================================================
-- JAÉN GUÍA · 0016: pagos con Stripe
--
-- Dos productos:
--   · Evento promocionado (5 €, pago único): el evento sale arriba
--     en la agenda y en portada hasta que se celebra.
--   · Plan Destacado (19 €/mes, suscripción): la ficha del negocio
--     arriba en portada y en su categoría; sus eventos se
--     promocionan solos al publicarlos.
-- El cobro lo hace Stripe Checkout; el webhook /api/webhooks/stripe
-- es el único que escribe aquí (con service_role, salta la RLS).
-- =========================================================

-- 1. Evento promocionado. Promocionado = promocionado_hasta > now().
--    Se guarda el fin del evento (fecha_fin o el final del día de
--    fecha_inicio); la ventana de 14 días antes la aplica la consulta
--    que lo pinta, así un pago adelantado no se pierde.
alter table eventos add column if not exists promocionado_hasta timestamptz;

comment on column eventos.promocionado_hasta is
  'Hasta cuándo el evento está promocionado (pago único o incluido en el plan Destacado). null = no promocionado.';

create index if not exists idx_eventos_promocionados
  on eventos (fecha_inicio)
  where promocionado_hasta is not null and estado = 'publicado';

-- 2. Suscripción del plan Destacado. customer.subscription.deleted e
--    invoice.payment_failed no traen nuestra metadata: el negocio se
--    localiza por el id de suscripción.
alter table negocios add column if not exists stripe_customer_id text;
alter table negocios add column if not exists stripe_subscription_id text;

create unique index if not exists uq_negocios_stripe_subscription
  on negocios (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column negocios.stripe_subscription_id is
  'Suscripción de Stripe del plan Destacado (sub_…). null si nunca ha pagado o se dio de baja.';

-- 3. Idempotencia del webhook. Stripe reintenta si no recibe 200; el
--    id del evento se inserta antes de procesar y un conflicto = ya
--    hecho.
create table stripe_eventos (
  id text primary key,
  tipo text not null,
  procesado_en timestamptz not null default now()
);

-- Sin RLS abierta: solo service_role escribe y lee.
alter table stripe_eventos enable row level security;
