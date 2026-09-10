-- 1. Añadir nuevas columnas a perfiles
ALTER TABLE public.perfiles 
  ADD COLUMN IF NOT EXISTS apellidos text,
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS es_de_jaen boolean DEFAULT false;

-- 2. Actualizar el trigger de creación de usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, apellidos, username, es_de_jaen)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'apellidos',
    new.raw_user_meta_data->>'username',
    COALESCE((new.raw_user_meta_data->>'es_de_jaen')::boolean, false)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
