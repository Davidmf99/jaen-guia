export interface Municipio {
  id: string
  nombre: string
  slug: string
  es_capital: boolean
}

export interface Categoria {
  id: string
  nombre: string
  slug: string
  tipo: 'comer_beber' | 'ocio' | 'tienda' | 'cultura' | 'naturaleza'
  icono: string | null
  orden: number
}

export interface Negocio {
  id: string
  nombre: string
  slug: string
  categoria_id: string
  categoria?: Categoria
  municipio_id: string
  descripcion: string | null
  descripcion_corta: string | null
  direccion: string | null
  zona: string | null
  lat: number | null
  lng: number | null
  telefono: string | null
  horario: Record<string, string> | null
  web: string | null
  imagen_portada: string | null
  google_place_id: string | null
  google_photo_name: string | null
  google_photo_atribucion: string | null
  rango_precio: '€' | '€€' | '€€€' | '€€€€' | null
  tipo_cocina: string[]
  especialidades: string[]
  servicios: string[]
  email: string | null
  instagram: string | null
  destacado: boolean
  /** destacado OR plan = 'destacado' (columna generada, 0017). */
  es_destacado: boolean
  es_imprescindible: boolean
  plan: 'gratis' | 'destacado'
  activo: boolean
  // Campo calculado en el cliente/API a partir de resenas
  puntuacion_media?: number
  num_resenas?: number
}

export interface Resena {
  id: string
  negocio_id: string
  usuario_id: string
  puntuacion: number
  texto: string | null
  es_oficial: boolean
  created_at: string
}

export type EstadoEvento = 'borrador' | 'publicado' | 'cancelado' | 'aplazado'
export type OrigenEvento = 'admin' | 'negocio' | 'scraper'

export interface Evento {
  id: string
  titulo: string
  // Lo rellena el trigger eventos_slug si se inserta vacío.
  slug: string
  descripcion: string | null
  categoria_id: string | null
  categoria?: Categoria
  negocio_id: string | null
  municipio_id: string | null
  imagen: string | null
  fecha_inicio: string
  fecha_fin: string | null
  es_todo_el_dia: boolean
  estado: EstadoEvento
  es_gratis: boolean
  // Texto libre a propósito ("12 € / 8 € reducida", "taquilla
  // inversa"): solo es_gratis es filtrable.
  precio_texto: string | null
  origen: OrigenEvento
  fuente_nombre: string | null
  fuente_url: string | null
  creado_por: string | null
  lugar_nombre: string | null
  direccion: string | null
  lat: number | null
  lng: number | null
  duplicado_de: string | null
  // Columnas generadas en Postgres: solo lectura.
  url_canonica: string | null
  huella: string
  created_at: string
  actualizado_at: string
}

export interface Promocion {
  id: string
  negocio_id: string
  titulo: string
  descripcion: string | null
  descuento: string | null
  fecha_inicio: string
  fecha_fin: string | null
}

export interface Perfil {
  id: string
  nombre: string | null
  avatar_url: string | null
  rol: 'usuario' | 'negocio' | 'admin'
}
