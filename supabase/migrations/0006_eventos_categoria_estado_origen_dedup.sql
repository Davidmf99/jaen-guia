-- =========================================================
-- JAÉN GUÍA · 0006: eventos con categoría, estado, precio,
-- origen y deduplicación
--
-- La tabla `eventos` ya existe desde 0001_init.sql (la lee
-- src/components/home/EventosProximos.tsx). Esta migración la
-- amplía; no se crea una tabla nueva.
--
-- El esquema queda preparado para el scraper de agendas
-- oficiales (origen = 'scraper') aunque todavía no exista: no
-- hará falta migrar nada cuando llegue.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Helpers inmutables
--
-- Postgres exige IMMUTABLE para usar una función en una
-- columna generada o en un índice. De ahí que aquí no se use
-- unaccent() (STABLE, depende del diccionario instalado) ni
-- date(timestamptz) (STABLE, depende del GUC TimeZone).
-- ---------------------------------------------------------

-- Texto normalizado para la huella de deduplicación: sin
-- tildes, en minúsculas, sin puntuación, espacios colapsados.
create or replace function public.normaliza_texto(txt text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select btrim(
    regexp_replace(
      lower(translate(
        txt,
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
      )),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

-- Día local del evento como 'YYYY-MM-DD'. Se marca IMMUTABLE a
-- sabiendas: asumimos que las reglas de huso de Europe/Madrid
-- no cambian. Si cambiaran solo afectaría a eventos que
-- empiezan exactamente a medianoche.
create or replace function public.dia_local(ts timestamptz)
returns text
language sql
immutable
strict
parallel safe
as $$
  select to_char(ts at time zone 'Europe/Madrid', 'YYYY-MM-DD');
$$;

-- Canonicaliza una URL para deduplicar:
--   · quita el fragmento (#...)
--   · quita el esquema (http/https) y el "www."
--   · pasa el HOST a minúsculas y deja el PATH tal cual
--     (los paths sí son sensibles a mayúsculas)
--   · quita las barras finales
--   · elimina los parámetros de tracking y ordena el resto
--
-- Lista NEGRA de parámetros, no lista blanca: muchas agendas
-- municipales identifican el evento con un query param
-- (?id=4821) y con lista blanca se perdería, fusionando
-- eventos que en realidad son distintos.
--
-- "https://www.Jaen.es/agenda/concierto/?utm_source=fb"
-- y "http://jaen.es/agenda/concierto" dan la misma cadena.
create or replace function public.normaliza_url(u text)
returns text
language sql
immutable
strict
parallel safe
as $$
  with sin_frag as (
    select split_part(u, '#', 1) as v
  ),
  partes as (
    select
      regexp_replace(split_part(v, '?', 1), '^https?://', '', 'i') as resto,
      nullif(substring(v from '\?(.*)$'), '') as qs
    from sin_frag
  ),
  hostpath as (
    select
      regexp_replace(lower(split_part(resto, '/', 1)), '^www\.', '')
        || regexp_replace(coalesce(substring(resto from '/.*$'), ''), '/+$', '')
        as hp,
      qs
    from partes
  )
  select
    hp || coalesce(
      '?' || (
        select string_agg(p, '&' order by p)
        from unnest(string_to_array(qs, '&')) as t(p)
        where p <> ''
          and lower(split_part(p, '=', 1)) not in (
            'utm_source','utm_medium','utm_campaign','utm_term',
            'utm_content','utm_id','utm_source_platform',
            'fbclid','gclid','gbraid','wbraid','msclkid',
            'mc_cid','mc_eid','igshid','yclid','ref','ref_src','_ga'
          )
      ),
      ''
    )
  from hostpath;
$$;

-- Huella de contenido: municipio + día local + título
-- normalizado. Es la clave de deduplicación que funciona SIN
-- url, que es el caso de los eventos publicados por negocios.
--
-- Se extrae a función propia (en vez de escribir la expresión
-- suelta en la columna generada) para que el trigger de slug
-- pueda calcular exactamente lo mismo: en un trigger BEFORE
-- las columnas generadas todavía no están calculadas.
--
-- Sin STRICT a propósito: municipio_id puede ser null.
create or replace function public.eventos_huella(
  p_municipio_id uuid,
  p_fecha_inicio timestamptz,
  p_titulo text
)
returns text
language sql
immutable
parallel safe
as $$
  select md5(
    coalesce(p_municipio_id::text, '-')      || '|' ||
    public.dia_local(p_fecha_inicio)         || '|' ||
    public.normaliza_texto(p_titulo)
  );
$$;

-- Propiedad de un negocio, con EXACTAMENTE el mismo criterio
-- que el panel (src/app/panel/page.tsx) y que la RLS de
-- negocios: negocios.propietario_id = auth.uid().
--
-- security definer a propósito. En Postgres la RLS se aplica
-- también a las tablas referenciadas dentro de la expresión de
-- una policy, así que sin él la policy de negocios ("Negocios
-- visibles para todos" using activo = true) filtraría esta
-- subconsulta y un dueño con su negocio desactivado perdería el
-- acceso a sus propios eventos: 0 filas, en silencio, sin error.
create or replace function public.es_dueno_de_negocio(p_negocio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from negocios
    where id = p_negocio_id
      and propietario_id = auth.uid()
  );
$$;

revoke all on function public.es_dueno_de_negocio(uuid) from public;
-- anon TAMBIÉN necesita EXECUTE. Postgres evalúa todas las policies
-- de SELECT de la tabla, no solo la que acabará dejando pasar la
-- fila: sin este grant, la policy "Dueño ve sus eventos en borrador"
-- hace que cualquier lectura anónima de eventos falle con
-- "permission denied for function es_dueno_de_negocio" y la home se
-- queda sin eventos. Con auth.uid() null la función devuelve false,
-- así que no expone nada.
grant execute on function public.es_dueno_de_negocio(uuid) to anon, authenticated;

-- ---------------------------------------------------------
-- 2. Columnas nuevas
-- ---------------------------------------------------------

alter table eventos
  -- Misma tabla que usa la navegación de la web: Header.tsx
  -- recorre categorias y construye /[categoria] con
  -- categorias.slug. Así el filtro de eventos comparte
  -- secciones con el resto del sitio sin duplicar catálogo.
  add column categoria_id uuid references categorias(id),

  -- 'borrador' no es público. 'cancelado' y 'aplazado' sí lo
  -- son: quien ya tenía el evento visto debe ver el aviso, no
  -- que desaparezca sin más.
  add column estado text not null default 'publicado'
    check (estado in ('borrador','publicado','cancelado','aplazado')),

  -- Precio. es_gratis es lo único filtrable/indexable; el
  -- resto es texto libre porque las agendas dan cosas como
  -- "12 € / 8 € reducida" o "taquilla inversa" y parsearlas a
  -- número acierta poco. Si algún día hace falta ordenar por
  -- precio se añaden precio_min/precio_max.
  add column es_gratis boolean not null default false,
  add column precio_texto text,

  -- 'scraper' ya contemplado para no migrar el CHECK después.
  add column origen text not null default 'admin'
    check (origen in ('admin','negocio','scraper')),

  -- Trazabilidad del origen automático. fuente_nombre es la
  -- agenda concreta ("Ayuntamiento de Jaén", "Diputación").
  add column fuente_nombre text,
  add column fuente_url text,

  -- Quién lo metió. No sustituye a negocio_id: negocio_id dice
  -- de qué negocio ES el evento, creado_por quién lo creó.
  add column creado_por uuid references perfiles(id),

  -- Lugar para eventos que NO cuelgan de un negocio (los de
  -- agenda oficial: teatros, plazas, museos municipales).
  add column lugar_nombre text,
  add column direccion text,
  add column lat double precision,
  add column lng double precision,

  -- Ferias, exposiciones: la hora de fecha_inicio no significa
  -- nada y la UI no debe mostrarla.
  add column es_todo_el_dia boolean not null default false,

  -- Duplicado detectado a posteriori: se apunta aquí en lugar
  -- de borrar la fila.
  add column duplicado_de uuid references eventos(id) on delete set null,

  add column actualizado_at timestamptz not null default now();

alter table eventos
  add constraint eventos_fechas_coherentes
    check (fecha_fin is null or fecha_fin >= fecha_inicio),
  -- El scraper nunca escribe en la ficha de un negocio: si un
  -- evento de agenda oficial resulta ser de un negocio, se
  -- vincula a mano.
  add constraint eventos_origen_coherente
    check (origen <> 'scraper' or negocio_id is null);

-- ---------------------------------------------------------
-- 3. Deduplicación
--
-- Dos claves independientes porque cubren fallos distintos:
--
--   · Solo URL no vale: los eventos de negocio no tienen url,
--     serían invisibles al dedup.
--   · Solo (titulo, fecha_inicio) no vale: fecha_inicio es
--     timestamptz y la misma agenda scrapeada dos veces da
--     20:00 y 20:30; y el título llega como "Concierto de
--     Navidad" en una fuente y "CONCIERTO DE NAVIDAD - Teatro
--     Darymelia" en otra.
--
-- La huella normaliza al DÍA local (no al instante) y al
-- título sin tildes/puntuación/mayúsculas. "Feria de San
-- Lucas" y "FERIA DE SAN LUCAS." colapsan; "Ruta de la tapa"
-- de dos martes distintos no, porque cambia el día.
-- ---------------------------------------------------------

alter table eventos
  add column url_canonica text
    generated always as (
      case when fuente_url is null or btrim(fuente_url) = ''
           then null
           else public.normaliza_url(fuente_url)
      end
    ) stored;

create unique index uq_eventos_url_canonica
  on eventos (url_canonica)
  where url_canonica is not null;

alter table eventos
  add column huella text
    generated always as (
      public.eventos_huella(municipio_id, fecha_inicio, titulo)
    ) stored;

-- Único duro y sin negocio_id dentro de la huella: es lo que
-- permite que un evento ya creado a mano o por un negocio y el
-- mismo evento scrapeado después se detecten como duplicados.
-- El precio es que dos negocios distintos no pueden tener el
-- mismo día un evento con el mismo título exacto; el panel
-- debe dar un mensaje claro en ese caso.
create unique index uq_eventos_huella on eventos (huella);

-- Detección difusa. NO restringe nada: alimenta una cola de
-- revisión de "posibles duplicados" para los casos que la
-- huella no pilla porque el título difiere de verdad. No se
-- puede automatizar con un unique porque la similitud no es
-- transitiva.
create extension if not exists pg_trgm;

create index idx_eventos_titulo_trgm
  on eventos using gin (public.normaliza_texto(titulo) gin_trgm_ops);

-- ---------------------------------------------------------
-- 4. Slug automático
--
-- El slug era ya not null unique, lo que rompía al scraper:
-- dos agendas con el mismo título generan el mismo slug y la
-- segunda revienta. Se rellena solo cuando viene vacío, así
-- que un admin puede seguir poniendo un slug bonito a mano.
--
-- Trigger BEFORE, no columna generada, justo para permitir ese
-- slug manual. La constraint NOT NULL se evalúa después de los
-- triggers BEFORE, por eso se puede insertar sin slug.
--
-- El sufijo sale del id de la fila y NO de la huella, a
-- propósito. Si saliera de la huella, dos eventos duplicados
-- generarían el mismo slug y el insert fallaría por
-- eventos_slug_key ANTES que por uq_eventos_huella: eso rompe
-- el `on conflict (huella) do update` del scraper, porque
-- ON CONFLICT solo captura conflictos de su propio índice.
-- Derivando del id, la única clave de deduplicación es la
-- huella y el upsert funciona.
-- ---------------------------------------------------------

create or replace function public.eventos_rellena_slug()
returns trigger
language plpgsql
as $$
declare
  base text;
begin
  if new.slug is null or btrim(new.slug) = '' then
    base := btrim(left(replace(public.normaliza_texto(new.titulo), ' ', '-'), 60), '-');
    if base = '' then
      base := 'evento';
    end if;
    -- new.id ya viene relleno por el DEFAULT de la columna: los
    -- defaults se aplican antes que los triggers BEFORE.
    new.slug := base || '-' || left(replace(new.id::text, '-', ''), 8);
  end if;
  return new;
end;
$$;

create trigger eventos_slug
  before insert on eventos
  for each row execute function public.eventos_rellena_slug();

-- ---------------------------------------------------------
-- 5. actualizado_at
-- ---------------------------------------------------------

create or replace function public.touch_actualizado_at()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_at := now();
  return new;
end;
$$;

create trigger eventos_touch_actualizado
  before update on eventos
  for each row execute function public.touch_actualizado_at();

-- ---------------------------------------------------------
-- 6. Índices de consulta
-- ---------------------------------------------------------

create index idx_eventos_categoria on eventos (categoria_id);

create index idx_eventos_negocio
  on eventos (negocio_id)
  where negocio_id is not null;

-- La consulta real de la home (EventosProximos.tsx): próximos,
-- visibles, ordenados por fecha.
create index idx_eventos_agenda
  on eventos (fecha_inicio)
  where estado in ('publicado','cancelado','aplazado');

-- ---------------------------------------------------------
-- 7. RLS de eventos
--
-- El criterio de propiedad es el mismo que ya usa el panel de
-- negocios: negocios.propietario_id = auth.uid(), aquí a
-- través de es_dueno_de_negocio(). No se introduce ninguna
-- relación nueva.
-- ---------------------------------------------------------

-- La policy actual es `using (true)`: publicaría los borradores
-- en cuanto exista la columna estado.
drop policy "Eventos visibles para todos" on eventos;

create policy "Eventos publicados visibles para todos"
on eventos for select
using (
  estado in ('publicado','cancelado','aplazado')
  and duplicado_de is null
);

create policy "Dueño ve sus eventos en borrador"
on eventos for select
using (
  negocio_id is not null
  and public.es_dueno_de_negocio(negocio_id)
);

-- El WITH CHECK impide además que un dueño (a) cuelgue un
-- evento de un negocio que no es suyo y (b) se marque como
-- origen 'admin' o 'scraper'.
create policy "Dueño crea eventos de su negocio"
on eventos for insert
with check (
  negocio_id is not null
  and public.es_dueno_de_negocio(negocio_id)
  and origen = 'negocio'
  and duplicado_de is null
);

create policy "Dueño edita eventos de su negocio"
on eventos for update
using (
  negocio_id is not null
  and public.es_dueno_de_negocio(negocio_id)
)
with check (
  negocio_id is not null
  and public.es_dueno_de_negocio(negocio_id)
  and origen = 'negocio'
);

create policy "Dueño borra eventos de su negocio"
on eventos for delete
using (
  negocio_id is not null
  and public.es_dueno_de_negocio(negocio_id)
);

-- "Admin gestiona eventos" (0001_init.sql) se mantiene tal
-- cual: es la vía por la que entran los eventos cargados a
-- mano. El scraper irá con service_role, que salta la RLS.

-- ---------------------------------------------------------
-- 8. Arreglo de la RLS de promociones
--
-- Misma trampa de RLS anidada descrita en es_dueno_de_negocio:
-- la policy original hace `select 1 from negocios ...` y la
-- policy de SELECT de negocios (activo = true) filtra esa
-- subconsulta, así que un dueño con su negocio desactivado
-- perdía el acceso a sus propias promociones sin ningún error.
-- ---------------------------------------------------------

drop policy "Dueño gestiona sus promociones" on promociones;

create policy "Dueño gestiona sus promociones"
on promociones for all
using (public.es_dueno_de_negocio(negocio_id))
with check (public.es_dueno_de_negocio(negocio_id));

-- ---------------------------------------------------------
-- 9. Comentarios
-- ---------------------------------------------------------

comment on column eventos.categoria_id is
  'FK a categorias, la misma tabla que alimenta la navegación de la web (Header.tsx → /[categoria]). Permite filtrar eventos por las mismas secciones que los negocios.';

comment on column eventos.estado is
  'borrador (no público) | publicado | cancelado | aplazado. Cancelado y aplazado siguen siendo públicos para poder mostrar el aviso.';

comment on column eventos.origen is
  'Quién generó el evento: admin (carga manual), negocio (panel del propietario) o scraper (agendas oficiales, fase posterior).';

comment on column eventos.url_canonica is
  'fuente_url normalizada (sin esquema, www, barra final, fragmento ni parámetros de tracking; resto de parámetros ordenados). Columna generada, con índice único parcial: dos scrapeos de la misma URL con distinto tracking colisionan.';

comment on column eventos.huella is
  'md5(municipio | día local | título normalizado). Clave de deduplicación que funciona sin url, que es el caso de los eventos publicados por negocios. Único duro.';

comment on column eventos.duplicado_de is
  'Si se detecta a posteriori que este evento duplica a otro, se apunta aquí en lugar de borrarlo. Las filas con duplicado_de no null quedan fuera del SELECT público.';

comment on column eventos.creado_por is
  'Perfil que creó el evento. No sustituye a negocio_id: negocio_id dice de qué negocio ES el evento, creado_por quién lo metió.';
