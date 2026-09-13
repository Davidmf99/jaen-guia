-- =========================================================
-- JAÉN GUÍA · 0014: página de Facebook / Instagram conectada
--
-- El dueño conecta su página UNA vez desde /panel/[slug]
-- (Facebook Login). A partir de ahí un cron lee sus eventos de
-- Facebook (ya estructurados), sus publicaciones y su Instagram
-- (que en Meta cuelga de la página), y lo que parece un evento
-- entra como borrador en su panel. Es la vía sin fricción que
-- el buzón de WhatsApp (0013) no puede dar.
-- =========================================================

create table negocios_conexiones (
  negocio_id uuid not null references negocios(id) on delete cascade,
  plataforma text not null default 'facebook'
    check (plataforma in ('facebook')),

  page_id text not null,
  page_nombre text,
  -- Token de página de larga duración, CIFRADO (AES-GCM) en
  -- src/lib/cifrado.ts. Nunca se devuelve al navegador: ver el
  -- revoke de columna más abajo.
  page_token_cifrado text not null,

  -- Cuenta de Instagram Business vinculada a la página, si la hay.
  ig_user_id text,
  ig_username text,

  conectado_por uuid references perfiles(id),
  -- Desde cuándo pedir contenido en la siguiente sincronización.
  -- Al conectar se pone "ahora": no se importa el histórico, solo
  -- lo que publiquen a partir de conectar.
  ultima_sync timestamptz not null default now(),
  ultimo_error text,

  created_at timestamptz not null default now(),

  primary key (negocio_id, plataforma)
);

-- Una misma página no puede estar en dos negocios: evita que un
-- evento acabe duplicado en dos fichas.
create unique index uq_conexiones_page on negocios_conexiones (plataforma, page_id);

comment on table negocios_conexiones is
  'Página de Facebook (y su Instagram Business) conectada a un negocio. El cron /api/cron/sync-social la lee con service_role y crea eventos en borrador.';

alter table negocios_conexiones enable row level security;

-- El dueño ve que está conectado y puede desconectar. Conectar lo
-- hace el callback OAuth con service_role (no hay policy de insert).
create policy "Miembro ve la conexión de su negocio"
on negocios_conexiones for select
using (public.es_dueno_de_negocio(negocio_id));

create policy "Miembro desconecta su negocio"
on negocios_conexiones for delete
using (public.es_dueno_de_negocio(negocio_id));

create policy "Admin gestiona conexiones"
on negocios_conexiones for all
using (
  exists (select 1 from perfiles where id = auth.uid() and rol = 'admin')
)
with check (
  exists (select 1 from perfiles where id = auth.uid() and rol = 'admin')
);

-- El token no sale de la base para nadie que no sea service_role,
-- ni siquiera cifrado. PostgREST respeta los grants de columna: un
-- select("*") desde el navegador devuelve el resto de columnas.
revoke select (page_token_cifrado) on negocios_conexiones from anon, authenticated;

-- Fuente de lo importado, para enseñar "visto en tu Facebook" y
-- para enlazar al post original desde el panel.
comment on column eventos.fuente_url is
  'URL original del evento: ficha de la agenda scrapeada, o permalink del post/evento de Facebook o Instagram del que salió. url_canonica (generada) la usa para deduplicar.';
