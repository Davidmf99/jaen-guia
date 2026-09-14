-- =========================================================
-- JAÉN GUÍA · 0021: blindaje de RLS
--
-- Dos huecos de RLS detectados en la auditoría previa al
-- lanzamiento. Ambos eran explotables con una llamada directa a
-- PostgREST (anon key + sesión del usuario), saltándose las Server
-- Actions que sí validaban en el servidor: la RLS era la última línea
-- y tenía holgura.
--
--   C-1 (CRÍTICO) · Escalada de privilegios a admin.
--     La policy de UPDATE de `perfiles` (0001) no tenía WITH CHECK ni
--     protegía la columna `rol`. Cualquier usuario podía hacer
--       update perfiles set rol = 'admin' where id = auth.uid()
--     y quedar como admin, con todo lo que eso abre (Admin gestiona
--     negocios/eventos/membresías, /admin/*, buzón…).
--
--   I-1 (IMPORTANTE) · Reseñas "oficiales" falsificables.
--     La policy de INSERT/UPDATE de `resenas` solo comprobaba
--     usuario_id = auth.uid(); no restringía `es_oficial`. Un insert
--     directo con es_oficial = true plantaba una reseña con el
--     distintivo del equipo de Jaén Guía en cualquier negocio.
--
-- Idempotente: se puede reejecutar.
-- =========================================================

-- ---------------------------------------------------------
-- C-1 · perfiles: nadie cambia roles desde la aplicación
-- ---------------------------------------------------------

-- 1. La policy de UPDATE recupera su WITH CHECK explícito. Sin él,
--    Postgres reutiliza el USING, pero lo dejamos escrito para que la
--    intención quede clara: un usuario solo puede tocar SU propia fila.
drop policy if exists "El usuario edita su propio perfil" on perfiles;

create policy "El usuario edita su propio perfil"
on perfiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- 2. El WITH CHECK no basta para proteger `rol`: solo ve la fila nueva,
--    no puede comparar con la anterior para saber si `rol` ha cambiado.
--    La invariante real la impone un trigger BEFORE UPDATE, que sí ve
--    OLD y NEW.
--
--    Regla:
--      · service_role / SQL editor (auth.uid() nulo): pueden cambiar
--        roles. Es la vía por la que el equipo asigna 'admin' a mano.
--      · Un usuario final (auth.uid() no nulo):
--          - NUNCA cambia su propio rol (ni aunque ya fuera admin).
--          - Solo un admin existente puede cambiar el rol de OTRO.
--        Hoy la RLS de UPDATE ya limita a la fila propia, así que la
--        rama "admin cambia a otro" no es alcanzable desde la app; se
--        deja escrita para que siga siendo correcta si algún día se
--        añade una policy de admin sobre perfiles.
create or replace function public.proteger_rol_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rol is distinct from old.rol then
    if auth.uid() is not null then
      if auth.uid() = new.id then
        raise exception 'No puedes cambiar tu propio rol.'
          using errcode = '42501';
      elsif not public.es_admin() then
        raise exception 'Solo un administrador puede cambiar roles.'
          using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_proteger_rol on perfiles;

create trigger perfiles_proteger_rol
  before update on public.perfiles
  for each row execute function public.proteger_rol_perfil();

-- ---------------------------------------------------------
-- I-1 · resenas: es_oficial solo desde el servidor de confianza
-- ---------------------------------------------------------

-- Las reseñas del equipo (es_oficial = true) se crean con service_role,
-- que salta la RLS. Un usuario, vía RLS, nunca puede marcarla como
-- oficial, ni al crearla ni al editarla.
drop policy if exists "Usuario crea sus resenas" on resenas;

create policy "Usuario crea sus resenas"
on resenas for insert
with check (auth.uid() = usuario_id and es_oficial = false);

drop policy if exists "Usuario edita sus resenas" on resenas;

create policy "Usuario edita sus resenas"
on resenas for update
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id and es_oficial = false);
