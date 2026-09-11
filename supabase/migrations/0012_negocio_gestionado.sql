-- =========================================================
-- JAÉN GUÍA · 0012: ¿tiene ya gestor este negocio?
--
-- La ficha pública enseña "¿Es tu negocio?" solo si nadie lo gestiona
-- todavía. La RLS de negocios_miembros (0011) solo deja ver las filas
-- propias, así que un visitante no puede contar las aprobadas de otros:
-- hace falta una función security definer que responda sí/no sin
-- exponer quién es el miembro.
-- =========================================================

create or replace function public.negocio_gestionado(p_negocio_id uuid)
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
      and estado = 'aprobado'
  );
$$;

revoke all on function public.negocio_gestionado(uuid) from public;
grant execute on function public.negocio_gestionado(uuid) to anon, authenticated;
