-- =========================================================
-- JAÉN GUÍA · 0011: membresías de negocio (quién gestiona qué)
--
-- Hasta ahora la propiedad era negocios.propietario_id = auth.uid():
-- un dueño, un negocio, y solo se podía asignar a mano en SQL. Eso
-- no cubre ni a Panaceite (dos locales, misma dueña) ni a un local
-- con dueño + encargado, ni permite que alguien "reclame" su
-- negocio desde la web.
--
-- Esta migración:
--   1. Crea negocios_miembros (negocio × perfil, con estado).
--   2. Vuelca propietario_id existente como miembro 'dueno' aprobado.
--   3. Redefine es_dueno_de_negocio() sobre la tabla nueva. Las
--      policies de eventos y promociones (0006) ya llaman a esa
--      función, así que pasan a la tabla nueva sin tocarlas.
--   4. Cambia las policies de negocios y de storage para usarla.
--   5. Deja preparado el flujo de solicitud: cualquier usuario
--      logueado puede pedir gestionar un negocio (estado pendiente) o
--      dar de alta uno nuevo (activo = false) que solo verá él y el
--      admin hasta que se apruebe.
--
-- negocios.propietario_id se conserva por compatibilidad pero deja
-- de tener efecto: la fuente de verdad es negocios_miembros.
-- perfiles.rol = 'negocio' tampoco hace falta ya: "ser negocio" es
-- tener alguna membresía aprobada. 'admin' sigue igual.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Tabla
-- ---------------------------------------------------------
create table negocios_miembros (
  negocio_id uuid not null references negocios(id) on delete cascade,
  perfil_id  uuid not null references perfiles(id) on delete cascade,
  rol        text not null default 'dueno' check (rol in ('dueno', 'editor')),
  estado     text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  -- Lo que escribe quien reclama ("Soy el gerente, llámame al…") para
  -- que el admin pueda verificarlo.
  mensaje    text,
  telefono_contacto text,
  created_at timestamptz not null default now(),
  resuelto_en timestamptz,
  resuelto_por uuid references perfiles(id),
  primary key (negocio_id, perfil_id)
);

create index idx_negocios_miembros_perfil on negocios_miembros(perfil_id);
create index idx_negocios_miembros_pendientes on negocios_miembros(created_at) where estado = 'pendiente';

comment on table negocios_miembros is
  'Quién gestiona cada negocio. Una fila por (negocio, perfil). Solo las filas con estado = aprobado dan permisos; pendiente es una solicitud a la espera del admin.';

alter table negocios_miembros enable row level security;

-- ---------------------------------------------------------
-- 2. Backfill desde propietario_id
-- ---------------------------------------------------------
insert into negocios_miembros (negocio_id, perfil_id, rol, estado, resuelto_en)
select id, propietario_id, 'dueno', 'aprobado', now()
from negocios
where propietario_id is not null
on conflict do nothing;

comment on column negocios.propietario_id is
  'OBSOLETO desde 0011: la propiedad vive en negocios_miembros. Se conserva la columna para no romper datos antiguos; no la usa ninguna policy ni el panel.';

-- ---------------------------------------------------------
-- 3. Funciones de pertenencia
-- ---------------------------------------------------------

-- Misma firma que en 0006, así las policies de eventos y promociones
-- que ya la llaman pasan a la tabla nueva sin cambios. security
-- definer por el mismo motivo que allí: que la RLS de las tablas
-- consultadas dentro no filtre en silencio.
create or replace function public.es_dueno_de_negocio(p_negocio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from negocios_miembros
    where negocio_id = p_negocio_id
      and perfil_id = auth.uid()
      and estado = 'aprobado'
  );
$$;

-- Incluye pendientes y rechazadas: sirve para que quien ha dado de
-- alta o reclamado un negocio pueda ver su propia solicitud (y el
-- negocio inactivo que acaba de crear) en el panel.
create or replace function public.tiene_solicitud_negocio(p_negocio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from negocios_miembros
    where negocio_id = p_negocio_id
      and perfil_id = auth.uid()
  );
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol = 'admin'
  );
$$;

revoke all on function public.tiene_solicitud_negocio(uuid) from public;
revoke all on function public.es_admin() from public;
-- anon también, por lo mismo que en 0006: Postgres evalúa todas las
-- policies de SELECT y sin EXECUTE la lectura anónima falla entera.
grant execute on function public.tiene_solicitud_negocio(uuid) to anon, authenticated;
grant execute on function public.es_admin() to anon, authenticated;

-- ---------------------------------------------------------
-- 4. Policies de negocios_miembros
-- ---------------------------------------------------------

create policy "Usuario ve sus membresias"
on negocios_miembros for select
using (perfil_id = auth.uid() or public.es_admin());

-- Solo puede pedir para sí mismo y solo como pendiente: el estado lo
-- cambia el admin. Un dueño aprobado también puede añadir editores
-- (p. ej. un encargado), que entran igualmente como pendientes.
create policy "Usuario solicita gestionar un negocio"
on negocios_miembros for insert
with check (
  estado = 'pendiente'
  and (perfil_id = auth.uid() or public.es_dueno_de_negocio(negocio_id))
);

-- Retirar una solicitud propia (o dejar de gestionar un negocio).
create policy "Usuario retira su membresia"
on negocios_miembros for delete
using (perfil_id = auth.uid());

create policy "Admin gestiona membresias"
on negocios_miembros for all
using (public.es_admin())
with check (public.es_admin());

-- ---------------------------------------------------------
-- 5. Policies de negocios
-- ---------------------------------------------------------

drop policy "Dueño edita su negocio" on negocios;

create policy "Miembro edita su negocio"
on negocios for update
using (public.es_dueno_de_negocio(id))
with check (public.es_dueno_de_negocio(id));

-- Un negocio recién dado de alta desde el panel nace con activo =
-- false y no lo ve nadie salvo quien lo creó (y el admin) hasta que se
-- apruebe. Esta policy se suma a "Negocios visibles para todos"
-- (activo = true): las policies de SELECT se combinan con OR.
create policy "Solicitante ve su negocio inactivo"
on negocios for select
using (public.tiene_solicitud_negocio(id));

-- Alta de negocio nuevo desde el panel. Solo inactivo, sin destacar,
-- plan gratis: todo lo demás lo decide el admin al aprobar. El
-- insert de la membresía pendiente se hace justo después en la misma
-- Server Action; si fallara, el negocio quedaría huérfano e invisible
-- (activo = false), sin efecto público.
create policy "Usuario da de alta un negocio"
on negocios for insert
with check (
  auth.uid() is not null
  and activo = false
  and destacado = false
  and es_imprescindible = false
  and plan = 'gratis'
);

-- ---------------------------------------------------------
-- 6. Storage: portadas
-- ---------------------------------------------------------

drop policy "Dueño sube portada de su negocio" on storage.objects;
drop policy "Dueño actualiza portada de su negocio" on storage.objects;

create policy "Miembro sube portada de su negocio"
on storage.objects for insert
with check (
  bucket_id = 'negocios-portadas'
  and public.es_dueno_de_negocio(((storage.foldername(name))[1])::uuid)
);

create policy "Miembro actualiza portada de su negocio"
on storage.objects for update
using (
  bucket_id = 'negocios-portadas'
  and public.es_dueno_de_negocio(((storage.foldername(name))[1])::uuid)
);
