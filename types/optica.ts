export type EstadoOpticaOrden =
  | 'pendiente'
  | 'en_proceso'
  | 'en_laboratorio'
  | 'terminado'
  | 'entregado'
  | 'anulado'

export type EstadoTarea = 'en_proceso' | 'en_laboratorio' | 'terminada'
export type TipoOpticaItem = 'armazon' | 'cristal' | 'tratamiento' | 'otro'
export type UsoItem = 'lejos' | 'cerca' | 'ambos'
export type LaboratorioTipo = 'propio' | 'externo'
export type MetodoPagoOptica =
  | 'EFECTIVO'
  | 'TRANSFERENCIA'
  | 'TARJETA_DEBITO'
  | 'TARJETA_CREDITO'
  | 'CUENTA_CORRIENTE'
  | 'CHEQUE'
  | 'OTRO'

export const ESTADO_OPTICA_LABELS: Record<EstadoOpticaOrden, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  en_laboratorio: 'En laboratorio',
  terminado: 'Terminado',
  entregado: 'Entregado',
  anulado: 'Anulado',
}

export const TIPO_ITEM_LABELS: Record<TipoOpticaItem, string> = {
  armazon: 'Armazón',
  cristal: 'Cristal',
  tratamiento: 'Tratamiento',
  otro: 'Otro',
}

export const USO_ITEM_LABELS: Record<UsoItem, string> = {
  lejos: 'Lejos',
  cerca: 'Cerca',
  ambos: 'Lejos y cerca',
}

export const METODO_OPTICA_LABELS: Record<MetodoPagoOptica, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA_DEBITO: 'Tarjeta débito',
  TARJETA_CREDITO: 'Tarjeta crédito',
  CUENTA_CORRIENTE: 'Cuenta corriente',
  CHEQUE: 'Cheque',
  OTRO: 'Otro',
}

export interface OpticaMedico {
  id: number
  nombre: string
  matricula: string | null
  telefono: string | null
  activo: boolean
  created_at: string
}

export interface OpticaOrdenItem {
  id: number
  orden_id: number
  tipo: TipoOpticaItem
  uso: UsoItem | null
  nombre: string
  armazon_propio: boolean
  articulo_id: number | null
  variante_id: number | null
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  subtotal: number
  notas: string | null
}

export interface OpticaOrdenTarea {
  id: number
  orden_id: number
  titulo: string
  descripcion: string | null
  estado: EstadoTarea
  fecha: string
  fecha_fin: string | null
  usuario_id: string | null
  laboratorio_nombre: string | null
  laboratorio_tipo: LaboratorioTipo | null
  created_by: string | null
  created_at: string
  updated_at: string
  users?: { name: string | null; email: string } | null
}

export interface OpticaOrdenPago {
  id: number
  orden_id: number
  caja_sesion_id: number | null
  metodo: MetodoPagoOptica
  monto: number
  concepto: string | null
  referencia: string | null
  fecha_pago: string
  usuario_id: string | null
  created_at: string
}

// ── Servicios (reparaciones / ajustes) ──────────────────────────────────────

export type EstadoServicio = 'pendiente' | 'en_proceso' | 'terminado' | 'entregado' | 'anulado'
export type EstadoTareaServicio = 'en_proceso' | 'terminada'
export type TipoServicio =
  | 'garantia' | 'soldadura' | 'patillas' | 'plaquetas' | 'terminales'
  | 'tanza' | 'cristales' | 'embutir_bisgra' | 'pase_armazon'
  | 'cambio_cristales_sol_neutros' | 'otros'

export const ESTADO_SERVICIO_LABELS: Record<EstadoServicio, string> = {
  pendiente:  'Pendiente',
  en_proceso: 'En proceso',
  terminado:  'Terminado',
  entregado:  'Entregado',
  anulado:    'Anulado',
}

export const TIPO_SERVICIO_LABELS: Record<TipoServicio, string> = {
  garantia:                    'Garantía',
  soldadura:                   'Soldadura',
  patillas:                    'Patillas',
  plaquetas:                   'Plaquetas',
  terminales:                  'Terminales',
  tanza:                       'Tanza',
  cristales:                   'Cristales',
  embutir_bisgra:              'Embutir bisgra',
  pase_armazon:                'Pase armazón',
  cambio_cristales_sol_neutros: 'Cambio cristales sol neutros',
  otros:                       'Otros',
}

export const ESTADO_SERVICIO_BADGE: Record<EstadoServicio, string> = {
  pendiente:  'bg-slate-100 text-slate-700 border-slate-200',
  en_proceso: 'bg-blue-100 text-blue-700 border-blue-200',
  terminado:  'bg-green-100 text-green-700 border-green-200',
  entregado:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  anulado:    'bg-red-100 text-red-700 border-red-200',
}

export type EstadoTipoServicio = 'pendiente' | 'en_proceso' | 'terminado'

export const ESTADO_TIPO_SERVICIO_LABELS: Record<EstadoTipoServicio, string> = {
  pendiente:  'Pendiente',
  en_proceso: 'En proceso',
  terminado:  'Terminado',
}

export const ESTADO_TIPO_SERVICIO_BADGE: Record<EstadoTipoServicio, string> = {
  pendiente:  'bg-slate-100 text-slate-600',
  en_proceso: 'bg-blue-100 text-blue-700',
  terminado:  'bg-green-100 text-green-700',
}

export const TIPOS_SERVICIO_LIST: TipoServicio[] = [
  'garantia', 'soldadura', 'patillas', 'plaquetas', 'terminales',
  'tanza', 'cristales', 'embutir_bisgra', 'pase_armazon',
  'cambio_cristales_sol_neutros', 'otros',
]

export interface OpticaServicioTipo {
  id: number
  servicio_id: number
  tipo: TipoServicio
  detalle: string | null
  precio: number
  estado: EstadoTipoServicio
}

export interface OpticaServicioTarea {
  id: number
  servicio_id: number
  titulo: string
  descripcion: string | null
  estado: EstadoTareaServicio
  fecha: string | null
  fecha_fin: string | null
  usuario_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  users?: { name: string | null; email: string } | null
}

export interface OpticaServicioPago {
  id: number
  servicio_id: number
  caja_sesion_id: number | null
  metodo: MetodoPagoOptica
  monto: number
  concepto: string | null
  referencia: string | null
  fecha_pago: string
  usuario_id: string | null
  created_at: string
}

export interface OpticaServicio {
  id: number
  numero: string
  fecha: string
  fecha_prometida: string | null
  cliente_id: number | null
  costo_trabajo: number
  subtotal: number
  descuento_pct: number
  descuento_monto: number
  total: number
  anticipo: number
  detalle: string | null
  observaciones: string | null
  estado: EstadoServicio
  sucursal_id: number | null
  created_by: string
  created_at: string
  updated_at: string
  clientes?: { id?: number; nombre: string; telefono: string | null } | null
  optica_servicio_tipos?: OpticaServicioTipo[]
  optica_servicio_tareas?: OpticaServicioTarea[]
  optica_servicio_pagos?: OpticaServicioPago[]
}

// ── OT principal ──────────────────────────────────────────────────────────────

export interface OpticaOrden {
  id: number
  numero: string
  fecha: string
  fecha_prometida: string | null
  cliente_id: number | null
  medico_id: number | null
  medico_nombre: string | null
  receta_url: string | null
  lejos_od_esfera: number | null
  lejos_od_cilindro: number | null
  lejos_od_eje: number | null
  lejos_oi_esfera: number | null
  lejos_oi_cilindro: number | null
  lejos_oi_eje: number | null
  cerca_od_esfera: number | null
  cerca_od_cilindro: number | null
  cerca_od_eje: number | null
  cerca_oi_esfera: number | null
  cerca_oi_cilindro: number | null
  cerca_oi_eje: number | null
  adicion: number | null
  dp: number | null
  estado: EstadoOpticaOrden
  pedido_a: string | null
  observaciones: string | null
  costo_trabajo: number
  anticipo: number
  subtotal: number
  descuento_pct: number
  descuento_monto: number
  total: number
  sucursal_id: number | null
  created_by: string
  created_at: string
  updated_at: string
  clientes?: { nombre: string; telefono: string | null } | null
  optica_medicos?: { nombre: string; matricula: string | null } | null
  optica_orden_items?: OpticaOrdenItem[]
  optica_orden_tareas?: OpticaOrdenTarea[]
  optica_orden_pagos?: OpticaOrdenPago[]
}
