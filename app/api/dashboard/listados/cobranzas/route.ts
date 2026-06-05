import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getSucursalFilter } from '@/lib/sucursal'

export type CobranzaRow = {
  fecha: string
  ticket: string
  tipo: 'VTA' | 'ORD' | 'OT' | 'SV'
  forma_pago: string
  cliente: string | null
  importe: number
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const supabase = await getTenantClient(session)

    const { sucursalId, verTodas } = await getSucursalFilter()
    if (!sucursalId && !verTodas) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    const clienteId = searchParams.get('cliente_id')
    const formaPago = searchParams.get('forma_pago')

    const results = await Promise.allSettled([
      queryVentas(supabase, sucursalId, verTodas, desde, hasta, clienteId),
      queryOrdenes(supabase, sucursalId, verTodas, desde, hasta, clienteId),
      queryOptica(supabase, sucursalId, verTodas, desde, hasta, clienteId),
      queryServicios(supabase, sucursalId, verTodas, desde, hasta, clienteId),
    ])

    const ventasRes    = results[0].status === 'fulfilled' ? results[0].value : []
    const ordenesRes   = results[1].status === 'fulfilled' ? results[1].value : []
    const opticaRes    = results[2].status === 'fulfilled' ? results[2].value : []
    const serviciosRes = results[3].status === 'fulfilled' ? results[3].value : []

    let rows: CobranzaRow[] = [...ventasRes, ...ordenesRes, ...opticaRes, ...serviciosRes]

    if (formaPago && formaPago !== 'todos') {
      rows = rows.filter(r => r.forma_pago === formaPago)
    }

    rows.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.ticket.localeCompare(a.ticket))

    return NextResponse.json(rows)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

async function queryVentas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, sucursalId: number | null, verTodas: boolean,
  desde: string | null, hasta: string | null, clienteId: string | null,
): Promise<CobranzaRow[]> {
  let q = supabase
    .from('ventas')
    .select('numero, fecha, cliente_id, clientes(nombre), venta_pagos(metodo, monto)')
    .eq('estado', 'completada')
    .order('fecha', { ascending: false })
    .limit(500)

  if (!verTodas && sucursalId) q = q.eq('sucursal_id', sucursalId)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)
  if (clienteId) q = q.eq('cliente_id', parseInt(clienteId, 10))

  const { data } = await q
  if (!data) return []

  const rows: CobranzaRow[] = []
  for (const v of data) {
    const pagos = v.venta_pagos ?? []
    for (const p of pagos) {
      rows.push({
        fecha: v.fecha,
        ticket: `VTA-${v.numero}`,
        tipo: 'VTA',
        forma_pago: p.metodo,
        cliente: v.clientes?.nombre ?? null,
        importe: Number(p.monto),
      })
    }
  }
  return rows
}

async function queryOrdenes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, sucursalId: number | null, verTodas: boolean,
  desde: string | null, hasta: string | null, clienteId: string | null,
): Promise<CobranzaRow[]> {
  let q = supabase
    .from('ordenes_venta')
    .select('numero, fecha, cliente_id, clientes(nombre), orden_venta_pagos(metodo, monto, fecha_pago)')
    .eq('estado', 'confirmada')
    .limit(500)

  if (!verTodas && sucursalId) q = q.eq('sucursal_id', sucursalId)
  if (clienteId) q = q.eq('cliente_id', parseInt(clienteId, 10))

  const { data } = await q
  if (!data) return []

  const rows: CobranzaRow[] = []
  for (const o of data) {
    const pagos = o.orden_venta_pagos ?? []
    for (const p of pagos) {
      const fecha = p.fecha_pago ?? o.fecha
      if (desde && fecha < desde) continue
      if (hasta && fecha > hasta) continue
      rows.push({
        fecha,
        ticket: `ORD-${o.numero}`,
        tipo: 'ORD',
        forma_pago: p.metodo,
        cliente: o.clientes?.nombre ?? null,
        importe: Number(p.monto),
      })
    }
  }
  return rows
}

async function queryOptica(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, sucursalId: number | null, verTodas: boolean,
  desde: string | null, hasta: string | null, clienteId: string | null,
): Promise<CobranzaRow[]> {
  let q = supabase
    .from('optica_ordenes')
    .select('numero, fecha, cliente_id, clientes(nombre), optica_orden_pagos(metodo, monto, fecha_pago)')
    .neq('estado', 'anulado')
    .limit(500)

  if (!verTodas && sucursalId) q = q.eq('sucursal_id', sucursalId)
  if (clienteId) q = q.eq('cliente_id', parseInt(clienteId, 10))

  const { data } = await q
  if (!data) return []

  const rows: CobranzaRow[] = []
  for (const o of data) {
    const pagos = o.optica_orden_pagos ?? []
    for (const p of pagos) {
      const fecha = p.fecha_pago ?? o.fecha
      if (desde && fecha < desde) continue
      if (hasta && fecha > hasta) continue
      rows.push({
        fecha,
        ticket: `OT-${o.numero}`,
        tipo: 'OT',
        forma_pago: p.metodo,
        cliente: o.clientes?.nombre ?? null,
        importe: Number(p.monto),
      })
    }
  }
  return rows
}

async function queryServicios(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, sucursalId: number | null, verTodas: boolean,
  desde: string | null, hasta: string | null, clienteId: string | null,
): Promise<CobranzaRow[]> {
  let q = supabase
    .from('optica_servicios')
    .select('numero, fecha, cliente_id, clientes(nombre), optica_servicio_pagos(metodo, monto, fecha_pago)')
    .neq('estado', 'anulado')
    .limit(500)

  if (!verTodas && sucursalId) q = q.eq('sucursal_id', sucursalId)
  if (clienteId) q = q.eq('cliente_id', parseInt(clienteId, 10))

  const { data } = await q
  if (!data) return []

  const rows: CobranzaRow[] = []
  for (const s of data) {
    const pagos = s.optica_servicio_pagos ?? []
    for (const p of pagos) {
      const fecha = p.fecha_pago ?? s.fecha
      if (desde && fecha < desde) continue
      if (hasta && fecha > hasta) continue
      rows.push({
        fecha,
        ticket: s.numero,
        tipo: 'SV',
        forma_pago: p.metodo,
        cliente: s.clientes?.nombre ?? null,
        importe: Number(p.monto),
      })
    }
  }
  return rows
}
