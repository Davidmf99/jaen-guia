-- =========================================================
-- JAÉN GUÍA · 0015: seguimiento de redes públicas sin permiso
--                   del negocio
--
-- Vía sin fricción de verdad: el negocio no conecta nada.
--   · Instagram: Business Discovery API con la cuenta @jaenguia
--     lee los posts públicos de cualquier cuenta Business/Creator
--     por su usuario (negocios.instagram, ya existía).
--   · Facebook: no hay API pública; se usa un scraper externo
--     (Apify) sobre la URL de la página (negocios.facebook, nueva).
-- Lo leído entra en borrador por lib/buzon como todo lo demás, y
-- lo confirma el admin en /admin/borradores (o el dueño si entra).
-- =========================================================

alter table negocios add column if not exists facebook text;

comment on column negocios.facebook is
  'URL o nombre de la página de Facebook del negocio ("https://www.facebook.com/barpepe" o "barpepe"). La lee el scraper de /api/cron/sync-publico.';

-- Hasta dónde se ha leído cada red de cada negocio. Sin esto cada
-- pasada volvería a mandar a Claude los mismos posts (buzon_mensajes
-- los pararía por (canal, id) pero ya habríamos pagado la descarga).
create table negocios_seguimiento (
  negocio_id uuid not null references negocios(id) on delete cascade,
  plataforma text not null check (plataforma in ('instagram','facebook')),
  -- Usuario/URL tal como se resolvió en la última pasada, para ver en
  -- la bandeja qué se está leyendo de verdad.
  identificador text,
  ultima_sync timestamptz not null default now(),
  ultimo_error text,
  -- Cuenta personal (no Business) o página inexistente: se deja de
  -- intentar hasta que el admin lo revise.
  desactivado boolean not null default false,
  primary key (negocio_id, plataforma)
);

create index idx_seguimiento_pendiente
  on negocios_seguimiento (plataforma, ultima_sync)
  where desactivado = false;

alter table negocios_seguimiento enable row level security;

create policy "Admin gestiona seguimiento"
on negocios_seguimiento for all
using (
  exists (select 1 from perfiles where id = auth.uid() and rol = 'admin')
)
with check (
  exists (select 1 from perfiles where id = auth.uid() and rol = 'admin')
);

-- Confianza de la lectura de Claude, para que la bandeja del admin
-- ordene por lo que hay que mirar con lupa y para poder auto-publicar
-- solo lo de confianza alta.
alter table eventos add column if not exists confianza text
  check (confianza in ('alta','media','baja'));

comment on column eventos.confianza is
  'Confianza de Claude al leer el cartel (solo eventos que entraron por lib/buzon). alta = título y fecha inequívocos.';
