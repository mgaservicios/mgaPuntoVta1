export type EstadoOrden = 'borrador' | 'confirmada' | 'anulada'
export type CondicionPago = 'contado' | '30_dias' | '60_dias' | '90_dias' | 'cuenta_corriente' | 'otro'
export type MetodoPagoOrden = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'CUENTA_CORRIENTE' | 'NOTA_CREDITO' | 'CHEQUE' | 'OTRO'

export const CONDICION_LABELS: Record<CondicionPago, string> = {
  contado: 'Contado',
  '30_dias': '30 días',
  '60_dias': '60 días',
  '90_dias': '90 días',
  cuenta_corriente: 'Cuenta corriente',
  otro: 'Otro',
}

export const METODO_ORDEN_LABELS: Record<MetodoPagoOrden, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA_DEBITO: 'Tarjeta débito',
  TARJETA_CREDITO: 'Tarjeta crédito',
  CUENTA_CORRIENTE: 'Cuenta corriente',
  NOTA_CREDITO: 'Nota de crédito',
  CHEQUE: 'Cheque',
  OTRO: 'Otro',
}

export interface OrdenVentaItem {
  id: number
  orden_id: number
  articulo_id: number
  variante_id: number | null
  nombre_articulo: string
  descripcion_variante: string | null
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  subtotal: number
}

export interface OrdenVentaPago {
  id: number
  orden_id: number
  metodo: MetodoPagoOrden
  monto: number
  referencia: string | null
  nota_credito_id: number | null
  fecha_pago: string | null
}

export interface OrdenVenta {
  id: number
  numero: string
  fecha: string
  vencimiento: string | null
  cliente_id: number | null
  vendedor_id: string
  condicion_pago: CondicionPago
  subtotal: number
  descuento_pct: number
  descuento_monto: number
  total: number
  estado: EstadoOrden
  observaciones: string | null
  created_by: string
  created_at: string
  updated_at: string
  clientes?: { nombre: string; telefono: string | null } | null
  vendedores?: { nombre: string } | null
  sucursales?: { nombre: string; logo_url: string | null } | null
  orden_venta_items?: OrdenVentaItem[]
  orden_venta_pagos?: OrdenVentaPago[]
}
