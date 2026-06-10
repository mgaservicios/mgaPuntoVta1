export type TipoFormaPago = 'TARJETA_CREDITO' | 'TARJETA_DEBITO' | 'BANCARIA' | 'BILLETERA' | 'MONEDA'

export interface FormaPagoCuota {
  id: number
  cantidad_cuotas: number
  recargo_pct: number
}

export interface FormaPago {
  id: number
  nombre: string
  tipo: TipoFormaPago
  orden: number
  activo?: boolean
  formas_pago_cuotas: FormaPagoCuota[]
}

export const TIPO_FORMA_PAGO_LABELS: Record<TipoFormaPago, string> = {
  TARJETA_CREDITO: 'Tarjeta crédito',
  TARJETA_DEBITO:  'Tarjeta débito',
  BANCARIA:        'Bancaria',
  BILLETERA:       'Billetera',
  MONEDA:          'Moneda',
}

/** Tipos que muestran referencia + fecha en formularios de pago */
export const TIPOS_CON_REFERENCIA: TipoFormaPago[] = [
  'TARJETA_CREDITO', 'TARJETA_DEBITO', 'BANCARIA', 'BILLETERA',
]
