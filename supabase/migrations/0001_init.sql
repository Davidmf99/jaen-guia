-- =========================================================
-- JAÉN GUÍA · Schema inicial
-- Diseñado para arrancar con "Jaén capital" pero ya preparado
-- para escalar a toda la provincia (tabla municipios).
-- =========================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------
-- MUNICIPIOS (de momento solo tendrá la fila "Jaén")
-- ---------------------------------------------------------
create table municipios (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  slug text not null unique,
  es_capital boolean default false,
  created_at timestamptz default now()
);

insert into municipios (nombre, slug, es_capital)
values ('Jaén', 'jaen', true);

-- ---------------------------------------------------------
-- CATEGORÍAS (Gastronomía, Cultura, Naturaleza, Experiencias...)
-- ---------------------------------------------------------
create table categorias (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  slug text not null unique,
  tipo text not null check (tipo in ('comer_beber', 'ocio', 'tienda', 'cultura', 'naturaleza')),
  icono text, -- nombre del icono lucide-react
  orden int default 0
);

-- ---------------------------------------------------------
-- PERFILES (extiende auth.users de Supabase)
-- ---------------------------------------------------------
create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  avatar_url text,
  rol text not null default 'usuario' check (rol in ('usuario', 'negocio', 'admin')),
  created_at timestamptz default now()
);

-- ---------------------------------------------------------
-- NEGOCIOS (bares, tiendas, ocio...)
-- ---------------------------------------------------------
create table negocios (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  slug text not null unique,
  categoria_id uuid references categorias(id),
  municipio_id uuid references municipios(id) default (select id from municipios where slug = 'jaen'),
  descripcion text,
  descripcion_corta text,
  direccion text,
  lat double precision,
  lng double precision,
  telefono text,
  horario jsonb, -- { "lunes": "9:00-22:00", ... }
  web text,
  imagen_portada text,
  destacado boolean default false,
  es_imprescindible boolean default false, -- para el listado "Lugares Imprescindibles" del mapa
  plan text not null default 'gratis' check (plan in ('gratis', 'destacado')), -- publicidad exclusiva
  propietario_id uuid references perfiles(id), -- si el negocio se autogestiona
  activo boolean default true,
  created_at timestamptz default now()
);

create index idx_negocios_categoria on negocios(categoria_id);
create index idx_negocios_municipio on negocios(municipio_id);
create index idx_negocios_destacado on negocios(destacado) where destacado = true;

-- ---------------------------------------------------------
-- IMÁGENES DE NEGOCIO (galería)
-- ---------------------------------------------------------
create table imagenes_negocio (
  id uuid primary key default uuid_generate_v4(),
  negocio_id uuid references negocios(id) on delete cascade,
  url text not null,
  orden int default 0
);

-- ---------------------------------------------------------
-- RESEÑAS
-- ---------------------------------------------------------
create table resenas (
  id uuid primary key default uuid_generate_v4(),
  negocio_id uuid references negocios(id) on delete cascade,
  usuario_id uuid references perfiles(id) on delete cascade,
  puntuacion int not null check (puntuacion between 1 and 5),
  texto text,
  es_oficial boolean default false, -- reseña hecha por el equipo de Jaén Guía
  created_at timestamptz default now(),
  unique (negocio_id, usuario_id) -- un usuario, una reseña por negocio
);

create index idx_resenas_negocio on resenas(negocio_id);

-- ---------------------------------------------------------
-- EVENTOS
-- ---------------------------------------------------------
create table eventos (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  slug text not null unique,
  descripcion text,
  negocio_id uuid references negocios(id), -- opcional: evento ligado a un negocio
  municipio_id uuid references municipios(id) default (select id from municipios where slug = 'jaen'),
  imagen text,
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz,
  created_at timestamptz default now()
);

create index idx_eventos_fecha on eventos(fecha_inicio);

-- ---------------------------------------------------------
-- PROMOCIONES / OFERTAS
-- ---------------------------------------------------------
create table promociones (
  id uuid primary key default uuid_generate_v4(),
  negocio_id uuid references negocios(id) on delete cascade,
  titulo text not null,
  descripcion text,
  descuento text, -- ej. "2x1", "20% dto."
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------
-- FAVORITOS (usuario <-> negocio)
-- ---------------------------------------------------------
create table favoritos (
  usuario_id uuid references perfiles(id) on delete cascade,
  negocio_id uuid references negocios(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (usuario_id, negocio_id)
);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table perfiles enable row level security;
alter table negocios enable row level security;
alter table imagenes_negocio enable row level security;
alter table resenas enable row level security;
alter table eventos enable row level security;
alter table promociones enable row level security;
alter table favoritos enable row level security;

-- Perfiles: cada uno ve y edita el suyo; lectura pública del nombre/avatar
create policy "Perfiles visibles para todos" on perfiles for select using (true);
create policy "El usuario edita su propio perfil" on perfiles for update using (auth.uid() = id);

-- Negocios: lectura pública; solo admin o el propio dueño puede editar
create policy "Negocios visibles para todos" on negocios for select using (activo = true);
create policy "Admin gestiona negocios" on negocios for all using (
  exists (select 1 from perfiles where id = auth.uid() and rol = 'admin')
);
create policy "Dueño edita su negocio" on negocios for update using (
  propietario_id = auth.uid()
);

-- Reseñas: lectura pública; el usuario crea/edita/borra solo las suyas
create policy "Resenas visibles para todos" on resenas for select using (true);
create policy "Usuario crea sus resenas" on resenas for insert with check (auth.uid() = usuario_id);
create policy "Usuario edita sus resenas" on resenas for update using (auth.uid() = usuario_id);
create policy "Usuario borra sus resenas" on resenas for delete using (auth.uid() = usuario_id);

-- Eventos y promociones: lectura pública; gestión solo admin/dueño del negocio
create policy "Eventos visibles para todos" on eventos for select using (true);
create policy "Admin gestiona eventos" on eventos for all using (
  exists (select 1 from perfiles where id = auth.uid() and rol = 'admin')
);
create policy "Promociones visibles para todos" on promociones for select using (true);
create policy "Dueño gestiona sus promociones" on promociones for all using (
  exists (select 1 from negocios where id = negocio_id and propietario_id = auth.uid())
);

-- Favoritos: cada usuario ve y gestiona solo los suyos
create policy "Usuario ve sus favoritos" on favoritos for select using (auth.uid() = usuario_id);
create policy "Usuario gestiona sus favoritos" on favoritos for all using (auth.uid() = usuario_id);

-- ---------------------------------------------------------
-- Trigger: crear perfil automáticamente al registrarse
-- ---------------------------------------------------------
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, new.raw_user_meta_data->>'nombre');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------
-- Categorías iniciales de ejemplo
-- ---------------------------------------------------------
insert into categorias (nombre, slug, tipo, icono, orden) values
  ('Dónde Comer', 'donde-comer', 'comer_beber', 'utensils-crossed', 1),
  ('Qué Ver', 'que-ver', 'cultura', 'landmark', 2),
  ('Actividades Culturales', 'actividades-culturales', 'cultura', 'palette', 3),
  ('Turismo Rural', 'turismo-rural', 'naturaleza', 'trees', 4),
  ('Tiendas', 'tiendas', 'tienda', 'shopping-bag', 5);
