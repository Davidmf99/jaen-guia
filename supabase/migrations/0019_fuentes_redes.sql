-- JAÉN GUÍA · 0019: cuentas fuente en redes
--
-- Hasta ahora solo se leían las redes de cada negocio. Hay cuentas que
-- publican los eventos de media ciudad sin ser un negocio (agregadores
-- de ocio, grupos de Facebook de una sala, peñas): aquí se registran y
-- el cron las lee igual. El evento resultante no cuelga de ningún
-- negocio salvo que el cartel nombre uno que exista en la guía.

create table fuentes_redes (
  id uuid primary key default uuid_generate_v4(),
  plataforma text not null check (plataforma in ('instagram','facebook','facebook_grupo')),
  -- Usuario de Instagram, URL de la página o URL del grupo.
  identificador text not null,
  nombre text not null,
  notas text,
  activa boolean not null default true,
  ultima_sync timestamptz,
  ultimo_error text,
  created_at timestamptz not null default now(),
  unique (plataforma, identificador)
);

comment on table fuentes_redes is
  'Cuentas de Instagram/Facebook que difunden eventos de otros (agregadores, grupos, peñas). Las lee sync-publico como a los negocios; el evento sale sin negocio, con el lugar del cartel.';

alter table fuentes_redes enable row level security;
-- Solo el service_role (cron y scripts) las toca; no hay policy pública.

-- Un evento leído de una cuenta fuente no tiene negocio. La regla de
-- 0013 ("un evento social siempre cuelga de un negocio, para saber
-- quién lo confirma") ya no aplica: la publicación es automática.
alter table eventos drop constraint if exists eventos_social_con_negocio;

alter table buzon_mensajes
  add column if not exists fuente_id uuid references fuentes_redes(id) on delete set null;

-- Las dos primeras, que pasó el padre de David (14 sept 2026).
insert into fuentes_redes (plataforma, identificador, nombre, notas) values
  ('instagram', 'nipopnijazz_ocioycultura', 'Ni Pop Ni Jazz · ocio y cultura', 'Agregador de ocio y cultura de Jaén'),
  ('facebook_grupo', 'https://www.facebook.com/groups/1045523825482485/', 'Sala La Bola de Cristal (grupo)', 'Grupo de Facebook de la sala')
on conflict do nothing;
