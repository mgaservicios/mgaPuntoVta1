export interface ListaPrecio {
  id: number
  nombre: string
  tipo: 'manual' | 'calculada'
  categoria: 'costo' | 'venta'
  lista_base_id: number | null
  porcentaje: number | null
  activo: boolean
  created_at: string
  updated_at: string
  lista_base?: Pick<ListaPrecio, 'id' | 'nombre'>
}

export interface ListaPrecioFormData {
  nombre: string
  tipo: 'manual' | 'calculada'
  categoria: 'costo' | 'venta'
  lista_base_id?: number | null
  porcentaje?: number | null
  activo: boolean
}

export interface Precio {
  id: number
  articulo_id: number
  variante_id: number | null
  lista_precio_id: number
  precio: number
  vigente_desde: string
  origen_tipo: 'manual' | 'proveedor' | 'sucursal' | 'remito' | null
  origen_proveedor_id: number | null
  origen_sucursal_id: number | null
  remito_id: number | null
  created_by: string | null
  created_at: string
  lista_precio?: Pick<ListaPrecio, 'id' | 'nombre' | 'tipo' | 'categoria'>
  proveedor?: { nombre: string }
  sucursal?: { nombre: string }
}

export interface PrecioVigente extends Precio {
  precio_calculado?: number
  heredado?: boolean   // true cuando la variante hereda el precio del artículo base
}

export interface PrecioFormData {
  lista_precio_id: number
  precio: number
  vigente_desde?: string
  origen_tipo: 'manual' | 'proveedor' | 'sucursal'
  origen_proveedor_id?: number | null
  origen_sucursal_id?: number | null
}

export interface ArticuloPreciosResponse {
  vigentes: PrecioVigente[]
  historial: Precio[]
}
