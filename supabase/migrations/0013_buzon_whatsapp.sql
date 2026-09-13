-- =========================================================
-- JAÉN GUÍA · 0013: buzón de WhatsApp → eventos en borrador
--
-- Un dueño ya hace el cartel del concierto para su Instagram.
-- Pedirle que lo vuelva a teclear en /panel es pedirle dos
-- veces lo mismo, y no lo hace. Esta migración prepara el
-- camino contrario: reenvía el cartel por WhatsApp al número
-- de Jaén Guía, Claude lee la imagen, y el evento aparece en
-- su panel como borrador para que lo confirme con un toque.
--
-- Fase 1 = WhatsApp. `canal` y `origen` ya admiten 'facebook' e
-- 'instagram' para la fase 2 (página conectada o mención a
-- @jaenguia) sin tocar los CHECK.
-- =========================================================

-- ---------------------------------------------------------
-- 1. eventos.origen admite 'whatsapp'
--
-- eventos_origen_coherente (scraper ⇒ sin negocio) no cambia:
-- un evento de WhatsApp SIEMPRE cuelga de un negocio, es la
-- única forma de saber quién lo confirma.
-- ---------------------------------------------------------

alter table eventos drop constraint eventos_origen_check;
alter table eventos
  add constraint eventos_origen_check
    check (origen in ('admin','negocio','scraper','whatsapp','facebook','instagram'));

-- Un evento que entra por una red social SIEMPRE cuelga de un
-- negocio: es la única forma de saber quién lo confirma.
alter table eventos
  add constraint eventos_social_con_negocio
    check (origen not in ('whatsapp','facebook','instagram') or negocio_id is not null);

comment on column eventos.origen is
  'Quién generó el evento: admin (carga manual), negocio (panel del propietario), scraper (agendas oficiales), o whatsapp/facebook/instagram (contenido del negocio en ese canal, leído por Claude o importado de la API; nace como borrador).';

-- El dueño publica (borrador → publicado) y borra los borradores
-- que le llegan por WhatsApp. Las policies de 0006 exigían
-- origen = 'negocio' en el WITH CHECK del UPDATE: sin esto el
-- botón "Publicar" fallaría con 42501.
drop policy "Dueño edita eventos de su negocio" on eventos;

create policy "Dueño edita eventos de su negocio"
on eventos for update
using (
  negocio_id is not null
  and public.es_dueno_de_negocio(negocio_id)
)
with check (
  negocio_id is not null
  and public.es_dueno_de_negocio(negocio_id)
  and origen in ('negocio','whatsapp','facebook','instagram')
);

-- ---------------------------------------------------------
-- 2. Buzón: cada mensaje recibido, tal cual llegó
--
-- Se guarda ANTES de procesarlo. Si Claude falla, Meta reenvía
-- el webhook o el dueño manda tres fotos seguidas, siempre hay
-- una fila con la que reconstruir lo que pasó. wa_message_id
-- es único: Meta reintenta los webhooks que no reciben 200 y
-- sin esto cada reintento crearía otro borrador.
-- ---------------------------------------------------------

create table buzon_mensajes (
  id uuid primary key default uuid_generate_v4(),

  canal text not null default 'whatsapp'
    check (canal in ('whatsapp','facebook','instagram')),

  -- Id en la plataforma de origen: wamid.… en WhatsApp, id del post
  -- o del evento en Facebook/Instagram.
  mensaje_externo_id text not null,

  -- Teléfono en formato internacional sin '+', que es como lo
  -- manda Meta ("34600111222"). Se normaliza igual al buscar
  -- el negocio.
  remitente text not null,
  remitente_nombre text,

  texto text,
  -- Ruta dentro del bucket `buzon` (no la URL): la URL se
  -- construye al vuelo y así un cambio de proyecto no rompe
  -- las filas antiguas.
  imagen_path text,
  imagen_mime text,

  -- Negocio resuelto a partir del teléfono. Null = no se supo
  -- de quién es; el admin lo asigna a mano desde la bandeja.
  negocio_id uuid references negocios(id) on delete set null,

  estado text not null default 'recibido'
    check (estado in (
      'recibido',      -- guardado, pendiente de procesar
      'sin_negocio',   -- teléfono desconocido: a la bandeja del admin
      'no_es_evento',  -- Claude no vio un evento (foto de la tapa del día)
      'borrador',      -- evento creado en borrador, esperando al dueño
      'duplicado',     -- ya existía ese evento (uq_eventos_huella)
      'error'          -- fallo al descargar la imagen o al llamar a Claude
    )),

  -- Lo que devolvió Claude, entero. Sirve para depurar prompts
  -- y para no volver a pagar la llamada si hay que reprocesar.
  extraccion jsonb,
  error text,

  evento_id uuid references eventos(id) on delete set null,

  created_at timestamptz not null default now(),
  procesado_en timestamptz,

  unique (canal, mensaje_externo_id)
);

create index idx_buzon_negocio on buzon_mensajes (negocio_id, created_at desc);
create index idx_buzon_pendientes on buzon_mensajes (created_at)
  where estado in ('recibido','sin_negocio','error');

comment on table buzon_mensajes is
  'Mensajes que llegan al número de WhatsApp de Jaén Guía (webhook de Meta). Cada fila es un mensaje; si trae cartel, Claude lo lee y crea un evento en borrador ligado al negocio del remitente.';

comment on column buzon_mensajes.remitente is
  'Teléfono del remitente tal como lo manda Meta: prefijo internacional sin "+" ni espacios (34600111222).';

-- El buzón lo escribe solo el webhook (service_role) y lo lee
-- el dueño del negocio al que se asignó, para ver de dónde
-- salió un borrador. El admin lo ve todo.
alter table buzon_mensajes enable row level security;

create policy "Dueño ve los mensajes de su negocio"
on buzon_mensajes for select
using (
  negocio_id is not null
  and public.es_dueno_de_negocio(negocio_id)
);

create policy "Admin gestiona el buzón"
on buzon_mensajes for all
using (
  exists (select 1 from perfiles where id = auth.uid() and rol = 'admin')
)
with check (
  exists (select 1 from perfiles where id = auth.uid() and rol = 'admin')
);

-- ---------------------------------------------------------
-- 3. Teléfono → negocio
--
-- Dos fuentes, sin tabla nueva:
--   · negocios.telefono (el que vino de Google): el fijo del
--     local o el móvil del dueño, según el negocio.
--   · negocios_miembros.telefono_contacto de una membresía
--     aprobada: el móvil que dio quien reclamó la ficha.
-- Se compara por los últimos 9 dígitos: "953 12 34 56",
-- "+34953123456" y "34953123456" son el mismo número. Si un
-- número sale en dos negocios, se descarta (null) y el admin
-- asigna a mano: mejor eso que colgar el evento del bar
-- equivocado.
-- ---------------------------------------------------------

create or replace function public.solo_digitos(txt text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select regexp_replace(txt, '[^0-9]', '', 'g');
$$;

create or replace function public.negocio_por_telefono(p_telefono text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with clave as (
    select right(public.solo_digitos(p_telefono), 9) as v
  ),
  candidatos as (
    select n.id
    from negocios n, clave
    where length(clave.v) = 9
      and right(public.solo_digitos(coalesce(n.telefono, '')), 9) = clave.v
    union
    select m.negocio_id
    from negocios_miembros m, clave
    where length(clave.v) = 9
      and m.estado = 'aprobado'
      and right(public.solo_digitos(coalesce(m.telefono_contacto, '')), 9) = clave.v
  )
  -- Postgres no tiene min(uuid): se cuenta y, si hay exactamente
  -- uno, se saca ese.
  select case when (select count(*) from candidatos) = 1
              then (select id from candidatos limit 1)
              else null end;
$$;

-- Solo la usa el webhook con service_role. service_role salta la
-- RLS pero NO los permisos de ejecución de funciones, así que hay
-- que dárselo explícitamente tras quitárselo a public.
revoke all on function public.negocio_por_telefono(text) from public;
grant execute on function public.negocio_por_telefono(text) to service_role;

-- Índices funcionales para que la búsqueda no recorra la tabla.
create index idx_negocios_telefono_9
  on negocios (right(public.solo_digitos(coalesce(telefono, '')), 9));
create index idx_miembros_telefono_9
  on negocios_miembros (right(public.solo_digitos(coalesce(telefono_contacto, '')), 9))
  where estado = 'aprobado';

-- ---------------------------------------------------------
-- 4. Bucket para los carteles
--
-- Público como negocios-portadas: la imagen del evento se
-- enseña en la agenda. Solo escribe service_role (el webhook);
-- no hay policy de insert para usuarios.
-- ---------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('buzon', 'buzon', true)
on conflict (id) do nothing;

create policy "Carteles del buzón visibles para todos"
on storage.objects for select
using (bucket_id = 'buzon');
