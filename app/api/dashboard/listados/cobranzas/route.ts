import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

export type CtaCteMovimiento = {
  id: number
  fecha: string
  tipo: 'CARGO' | 'PAGO'
  descripcion: string | null
  metodo: string | null
  importe: number
  saldo: number // saldo acumulado hasta este movimiento (de más antiguo a más reciente)
}

export type CtaCteCliente = {
  cliente_id: number
  nombre: string
  saldo_actual: number
  movimientos: CtaCteMovimiento[]
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { searchParams } = new URL(req.url)
  const desde     = searchParams.get('desde')
  const hasta     = searchParams.get('hasta')
  const clienteId = searchParams.get('cliente_id')

  // Traer TODOS los movimientos del cliente (sin filtro de fecha) para calcular
  // el saldo correcto desde el origen. El filtro de fecha se aplica solo al display.
  let q = supabase
    .from('cobranzas')
    .select('id, tipo, monto, fecha, descripcion, metodo, cliente_id, clientes(nombre)')
    .order('fecha', { ascending: true })
    .order('id',    { ascending: true })

  if (clienteId) q = q.eq('cliente_id', parseInt(clienteId, 10))

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Agrupar por cliente y calcular saldo corriente
  const map = new Map<number, CtaCteCliente>()

  for (const row of data ?? []) {
    if (!row.cliente_id) continue
    if (!map.has(row.cliente_id)) {
      map.set(row.cliente_id, {
        cliente_id: row.cliente_id,
        nombre: (row.clientes as unknown as { nombre: string } | null)?.nombre ?? `Cliente #${row.cliente_id}`,
        saldo_actual: 0,
        movimientos: [],
      })
    }
    const cliente = map.get(row.cliente_id)!
    const delta = row.tipo === 'CARGO' ? Number(row.monto) : -Number(row.monto)
    cliente.saldo_actual += delta
    cliente.movimientos.push({
      id:          row.id,
      fecha:       row.fecha,
      tipo:        row.tipo,
      descripcion: row.descripcion,
      metodo:      row.metodo,
      importe:     Number(row.monto),
      saldo:       cliente.saldo_actual,
    })
  }

  // Convertir a array, aplicar filtro de fechas sobre los movimientos a mostrar
  // y ordenar movimientos DESC para el display
  const result: CtaCteCliente[] = []

  for (const cliente of map.values()) {
    let movs = cliente.movimientos
    if (desde || hasta) {
      movs = movs.filter(m => {
        if (desde && m.fecha < desde) return false
        if (hasta && m.fecha > hasta) return false
        return true
      })
    }
    if (movs.length === 0 && (desde || hasta)) continue // skip si no hay movs en el rango
    result.push({
      ...cliente,
      movimientos: movs.slice().reverse(), // DESC para display
    })
  }

  // Ordenar clientes por saldo DESC (más deuda primero)
  result.sort((a, b) => b.saldo_actual - a.saldo_actual)

  return NextResponse.json(result)
}
