export type EstadoNotaCredito = 'pendiente' | 'utilizada' | 'anulada'

export interface NotaCredito {
  id: number
  numero: string
  cliente_id: number
  fecha: string
  monto: number
  monto_disponible: number
  estado: EstadoNotaCredito
  observaciones: string | null
  created_by: string
  created_at: string
  updated_at: string
  clientes?: { nombre: string }
}
