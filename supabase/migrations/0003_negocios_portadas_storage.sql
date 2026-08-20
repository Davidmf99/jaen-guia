-- =========================================================
-- JAÉN GUÍA · 0003: Storage para portadas de negocio
-- Bucket público de solo-lectura; solo el propietario del negocio
-- (negocios.propietario_id = auth.uid()) puede subir/actualizar
-- archivos dentro de su propia carpeta {negocio_id}/...
-- =========================================================

insert into storage.buckets (id, name, public)
values ('negocios-portadas', 'negocios-portadas', true);

create policy "Dueño sube portada de su negocio"
on storage.objects for insert
with check (
  bucket_id = 'negocios-portadas'
  and exists (
    select 1 from negocios
    where id::text = (storage.foldername(name))[1]
      and propietario_id = auth.uid()
  )
);

create policy "Dueño actualiza portada de su negocio"
on storage.objects for update
using (
  bucket_id = 'negocios-portadas'
  and exists (
    select 1 from negocios
    where id::text = (storage.foldername(name))[1]
      and propietario_id = auth.uid()
  )
);

-- Bucket marcado public = true → las lecturas (getPublicUrl) no pasan
-- por RLS, no hace falta policy de select.
