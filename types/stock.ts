export type TipoRemito = 'entrada' | 'salida'
export type EstadoRemito = 'borrador' | 'confirmado' | 'anulado'
export type ContraparteTipo = 'sucursal' | 'proveedor' | 'persona'

export interface RemitoItem {
  id: number
  remito_id: number
  articulo_id: number
  variante_id: number | null
  cantidad: number
  costo_unitario: number | null
  precios_extras?: Array<{ lista_precio_id: number; precio: number }> | null
  articulos?: { codigo: string | null; nombre: string }
  articulo_variantes?: { sku: string | null } | null
}

export interface Remito {
  id: number
  numero: string
  tipo: TipoRemito
  sucursal_id: number
  contraparte_tipo: ContraparteTipo
  contraparte_sucursal_id: number | null
  contraparte_proveedor_id: number | null
  contraparte_nombre: string | null
  fecha: string
  observaciones: string | null
  nro_externo: string | null
  estado: EstadoRemito
  created_by: string
  created_at: string
  updated_at: string
  contraparte_display?: string
  sucursal_nombre?: string
  remito_items?: RemitoItem[]
}
