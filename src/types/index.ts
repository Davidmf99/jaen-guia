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
  destacado: boolean
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

export interface Evento {
  id: string
  titulo: string
  slug: string
  descripcion: string | null
  negocio_id: string | null
  imagen: string | null
  fecha_inicio: string
  fecha_fin: string | null
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
