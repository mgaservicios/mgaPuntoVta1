export type ClienteTipo = 'PARTICULAR' | 'EMPRESA' | 'COMERCIO'

export interface Cliente {
  id: number
  nombre: string
  tipo: ClienteTipo
  email: string | null
  telefono: string | null
  direccion: string | null
  localidad: string | null
  cuit: string | null
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface ClienteFormData {
  nombre: string
  tipo: ClienteTipo
  email?: string
  telefono?: string
  direccion?: string
  localidad?: string
  cuit?: string
  notas?: string
  activo: boolean
}
