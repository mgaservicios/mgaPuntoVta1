export type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'CUENTA_CORRIENTE' | 'NOTA_CREDITO' | 'OTRO'
export type EstadoVenta = 'completada' | 'anulada'
export type EstadoCaja = 'abierta' | 'cerrada'
export type TipoMovCaja = 'ingreso' | 'egreso'

export interface VentaItem {
  id: number
  venta_id: number
  articulo_id: number
  variante_id: number | null
  nombre_articulo: string
  descripcion_variante: string | null
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  subtotal: number
}

export interface VentaPago {
  id: number
  venta_id: number
  metodo: MetodoPago
  monto: number
  referencia: string | null
}

export interface Venta {
  id: number
  numero: string
  fecha: string
  cliente_id: number | null
  vendedor_id: string
  caja_sesion_id: number
  subtotal: number
  descuento_pct: number
  descuento_monto: number
  total: number
  estado: EstadoVenta
  observaciones: string | null
  created_at: string
  updated_at: string
  clientes?: { nombre: string } | null
  vendedores?: { nombre: string } | null
  sucursales?: { nombre: string; logo_url: string | null } | null
  users?: { name: string | null; email: string } | null
  venta_items?: VentaItem[]
  venta_pagos?: VentaPago[]
}

export interface CajaSesion {
  id: number
  usuario_id: string
  fecha_apertura: string
  monto_apertura: number
  fecha_cierre: string | null
  monto_cierre: number | null
  monto_esperado: number | null
  diferencia: number | null
  observaciones: string | null
  estado: EstadoCaja
  fecha: string
  sesion_anterior_id: number | null
  users?: { name: string | null; email: string } | null
}

export interface CajaMovimiento {
  id: number
  sesion_id: number
  tipo: TipoMovCaja
  tipo_concepto: string | null
  concepto: string
  monto: number
  usuario_id: string
  created_at: string
}

export interface CajaMovimientoLog {
  id: number
  movimiento_id: number
  sesion_id: number
  accion: 'anulacion'
  tipo: TipoMovCaja
  tipo_concepto: string | null
  concepto: string
  monto: number
  usuario_original: string
  motivo: string
  usuario_anula: string
  created_at: string
}
