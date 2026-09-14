-- =========================================================
-- JAÉN GUÍA · 0022: rate limiting (I-2)
--
-- No había ningún límite de frecuencia en las Server Actions: el único
-- freno era el de Supabase Auth. Con publicidad en camino, eso deja
-- hueco a floods automatizados (reseñas, alta de eventos, solicitudes
-- de negocio, registro).
--
-- Se resuelve dentro de Postgres (ya lo tenemos) en vez de añadir
-- Redis/Upstash: una tabla de "golpes" y una función security definer
-- que cuenta los de la ventana y decide. La tabla tiene RLS activada y
-- SIN policies: solo la función (definer = owner, salta RLS) y
-- service_role la tocan; nadie más puede leer quién hizo qué.
-- =========================================================

create table if not exists public.limite_uso (
  actor      text not null,        -- 'user:<uuid>' o 'ip:<addr>'
  accion     text not null,        -- 'resena', 'evento', 'solicitud', 'registro'
  creado_at  timestamptz not null default now()
);

create index if not exists idx_limite_uso
  on public.limite_uso (accion, actor, creado_at desc);

alter table public.limite_uso enable row level security;
-- Sin policies a propósito: la tabla es privada del limitador.

-- Devuelve true si la acción está DENTRO del límite (y en ese caso
-- apunta el golpe); false si se ha pasado. Fail-safe del lado del
-- llamante: si la función fallara, el código no bloquea al usuario.
create or replace function public.consumir_limite(
  p_actor   text,
  p_accion  text,
  p_max     int,
  p_ventana interval
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  usados int;
begin
  if p_actor is null or p_actor = '' then
    return true;  -- sin actor identificable no se limita
  end if;

  -- Limpieza barata: quita golpes muy viejos de esta acción.
  delete from public.limite_uso
   where accion = p_accion
     and creado_at < now() - (p_ventana * 4);

  select count(*) into usados
    from public.limite_uso
   where accion = p_accion
     and actor  = p_actor
     and creado_at > now() - p_ventana;

  if usados >= p_max then
    return false;
  end if;

  insert into public.limite_uso (actor, accion) values (p_actor, p_accion);
  return true;
end;
$$;

revoke all on function public.consumir_limite(text, text, int, interval) from public;
grant execute on function public.consumir_limite(text, text, int, interval) to anon, authenticated;
