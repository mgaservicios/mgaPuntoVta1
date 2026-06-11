export interface Proveedor {
  id: number
  nombre: string
  cuit: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  localidad: string | null
  provincia: string | null
  cod_postal: string | null
  contacto: string | null
  pais: string
  tipo_iva: string | null
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface ProveedorFormData {
  nombre: string
  cuit?: string
  telefono?: string
  email?: string
  direccion?: string
  localidad?: string
  provincia?: string
  cod_postal?: string
  contacto?: string
  tipo_iva?: string
  notas?: string
  activo: boolean
}
