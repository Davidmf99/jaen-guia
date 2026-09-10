-- 1. Limpiamos cualquier rastro previo de la columna
DROP INDEX IF EXISTS idx_negocios_nombre_normalizado;
ALTER TABLE negocios DROP COLUMN IF EXISTS nombre_normalizado;

-- 2. REEMPLAZAMOS LA FUNCIÓN MANTENIENDO EL MISMO LENGUAJE (plpgsql) Y NOMBRE DE PARÁMETRO (txt)
-- Esto evita tener que borrar la función (y cargarnos el índice de eventos)
CREATE OR REPLACE FUNCTION public.normaliza_texto(txt text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN lower(
    translate(
      txt,
      'áéíóúÁÉÍÓÚäëïöüÄËÏÖÜ',
      'aeiouAEIOUaeiouAEIOU'
    )
  );
END;
$$;

-- 3. Añadimos la columna asegurando el formato text
ALTER TABLE negocios ADD COLUMN nombre_normalizado text GENERATED ALWAYS AS (public.normaliza_texto(nombre::text)) STORED;

-- 4. Recreamos el índice
CREATE INDEX idx_negocios_nombre_normalizado ON negocios(nombre_normalizado);
