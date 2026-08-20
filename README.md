# Jaén Guía

Directorio de gastronomía, cultura y ocio de Jaén capital (preparado para
escalar a toda la provincia). Next.js (App Router) + Tailwind CSS +
Supabase (Postgres, Auth, Storage, RLS) + Leaflet para el mapa.

## 1. Arrancar en local

```bash
npm install
cp .env.example .env.local   # y rellena con tus claves de Supabase
npm run dev
```

Abre http://localhost:3000

## 2. Crear el proyecto en Supabase

1. Crea un proyecto nuevo en https://supabase.com
2. Copia la URL y la clave `anon public` a tu `.env.local`
3. Ejecuta la migración inicial: abre el **SQL Editor** de Supabase y
   pega el contenido de `supabase/migrations/0001_init.sql` (o usa la
   CLI de Supabase: `supabase db push`)

Esto crea las tablas (`municipios`, `categorias`, `negocios`, `resenas`,
`eventos`, `promociones`, `favoritos`, `perfiles`), las políticas de
seguridad (RLS) y siembra los datos iniciales (municipio "Jaén" y las
5 categorías base).

## 3. Estructura del proyecto

```
src/
  app/                    → páginas (App Router)
  components/
    layout/Header.tsx     → cabecera y navegación
    home/
      Hero.tsx             → buscador + curva orgánica
      BentoDestacados.tsx  → grid asimétrico de negocios destacados
      EventosProximos.tsx  → carrusel de eventos
      EsenciaJaen.tsx       → sección editorial (foto olivares)
      MapaExperiencia.tsx   → mapa + lista de imprescindibles
      MapaLeaflet.tsx        → mapa Leaflet (carga solo en cliente)
      NegocioCard.tsx        → tarjeta de negocio reutilizable
  lib/supabase/
    client.ts             → cliente Supabase (navegador)
    server.ts             → cliente Supabase (servidor)
  types/index.ts           → tipos TS que reflejan el schema
  middleware.ts             → refresco de sesión de Supabase

supabase/migrations/0001_init.sql → schema completo + RLS
```

## 4. Datos de ejemplo (mock)

Los componentes de la home usan datos de ejemplo hardcodeados (marcados
con `// mock` en el código) para poder ver el diseño sin depender aún
de Supabase. El siguiente paso natural es sustituirlos por consultas
reales, por ejemplo en `BentoDestacados.tsx`:

```ts
const supabase = await createClient();
const { data: negocios } = await supabase
  .from("negocios")
  .select("*, categoria:categorias(nombre)")
  .eq("destacado", true)
  .limit(3);
```

## 5. Pendiente / próximos pasos

- [ ] Sustituir mocks por queries reales a Supabase
- [ ] Páginas de detalle de negocio (`/negocio/[slug]`)
- [ ] Formulario de alta de reseña (requiere login)
- [ ] Panel para que un negocio con plan "destacado" edite su ficha
- [ ] Páginas `/gastronomia`, `/cultura`, `/naturaleza`, `/experiencias`
      con listado filtrable
- [ ] Subir imágenes reales a Supabase Storage y sustituir los
      placeholders de `imagen_portada` / hero / olivares
