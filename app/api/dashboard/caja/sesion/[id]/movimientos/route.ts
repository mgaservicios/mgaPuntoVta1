import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { assertHomeSucursal } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

// Helper: verificar si un pago ya tiene movimiento en caja_movimientos
function pagoYaRegistrado(
  movs: { concepto: string; monto: number }[],
  patron: string,
  monto: number
): boolean {
  return movs.some(m =>
    m.concepto.includes(patron) && Number(m.monto) === Number(monto)
  )
}

type SynEntry = {
  id: number; sesion_id: number; tipo: 'ingreso';
  tipo_concepto: string; concepto: string; monto: number;
  usuario_id: string; created_at: string
}

export async function GET(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const sesionId = Number(id)

  const { data: sesionData } = await supabase
    .from('caja_sesiones')
    .select('fecha_apertura, fecha_cierre, sucursal_id')
    .eq('id', sesionId)
    .single()

  const desde = sesionData?.fecha_apertura
  const hasta  = sesionData?.fecha_cierre ?? new Date().toISOString()
  const sucursalId = sesionData?.sucursal_id

  // ── 1. Movimientos directos de caja_movimientos ────────────────────────────
  const { data: movs, error } = await supabase
    .from('caja_movimientos')
    .select('*')
    .eq('sesion_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const movsList = movs ?? []

  // ── 2. Ventas POS — por caja_sesion_id (NOT NULL garantizado) ─────────────
  const { data: ventasRows } = await supabase
    .from('ventas')
    .select('id, numero')
    .eq('caja_sesion_id', sesionId)
    .neq('estado', 'anulada')

  const ventaIds = (ventasRows ?? []).map(v => v.id)
  const ventaNumMap = Object.fromEntries((ventasRows ?? []).map(v => [v.id, v.numero]))

  const { data: ventaPagos } = ventaIds.length > 0
    ? await supabase.from('venta_pagos').select('id, venta_id, metodo, monto, created_at').in('venta_id', ventaIds)
    : { data: [] as { id: number; venta_id: number; metodo: string; monto: number; created_at: string }[] }

  // ── 3. Órdenes de venta — por rango de fechas (no tiene caja_sesion_id) ────
  const { data: ordenesRows } = sucursalId
    ? await supabase.from('ordenes_venta').select('id, numero').eq('sucursal_id', sucursalId).neq('estado', 'anulada')
    : { data: [] as { id: number; numero: number }[] }

  const ordenIds = (ordenesRows ?? []).map(o => o.id)
  const ordenNumMap = Object.fromEntries((ordenesRows ?? []).map(o => [o.id, o.numero]))

  const { data: ordenPagos } = ordenIds.length > 0
    ? await supabase.from('orden_venta_pagos').select('id, orden_id, metodo, monto, created_at').in('orden_id', ordenIds).gte('created_at', desde).lte('created_at', hasta)
    : { data: [] as { id: number; orden_id: number; metodo: string; monto: number; created_at: string }[] }

  // ── 4. OT — por rango de fechas (captura pagos con caja_sesion_id NULL) ────
  const { data: otPagosRaw } = await supabase
    .from('optica_orden_pagos')
    .select('id, orden_id, metodo, monto, created_at')
    .gte('created_at', desde)
    .lte('created_at', hasta)

  const otOrdenIds = [...new Set((otPagosRaw ?? []).map(p => p.orden_id))]
  const { data: otOrdenes } = otOrdenIds.length > 0
    ? await supabase.from('optica_ordenes').select('id, numero').in('id', otOrdenIds)
    : { data: [] as { id: number; numero: number }[] }
  const otNumMap = Object.fromEntries((otOrdenes ?? []).map(o => [o.id, o.numero]))

  // ── 5. Servicios — por rango de fechas (captura pagos con caja_sesion_id NULL) ─
  const { data: svPagosRaw } = await supabase
    .from('optica_servicio_pagos')
    .select('id, servicio_id, metodo, monto, created_at')
    .gte('created_at', desde)
    .lte('created_at', hasta)

  const svIds = [...new Set((svPagosRaw ?? []).map(p => p.servicio_id))]
  const { data: svOrdenes } = svIds.length > 0
    ? await supabase.from('optica_servicios').select('id, numero').in('id', svIds)
    : { data: [] as { id: number; numero: number }[] }
  const svNumMap = Object.fromEntries((svOrdenes ?? []).map(s => [s.id, s.numero]))

  // ── 6. Armar entradas sintéticas ──────────────────────────────────────────
  //    - CC y NC siempre se muestran como sintéticos
  //    - No-CC solo si no tienen movimiento en caja_movimientos (deduplicación)
  let synId = -1
  const SYNTH: SynEntry[] = []

  // Ventas POS
  for (const p of (ventaPagos ?? [])) {
    if (p.metodo === 'CUENTA_CORRIENTE' || p.metodo === 'NOTA_CREDITO') {
      SYNTH.push({
        id: synId--, sesion_id: sesionId, tipo: 'ingreso',
        tipo_concepto: p.metodo === 'CUENTA_CORRIENTE' ? 'Cuenta corriente' : 'Nota de crédito',
        concepto: `Venta #${ventaNumMap[p.venta_id] ?? p.venta_id}`,
        monto: Number(p.monto), usuario_id: '', created_at: p.created_at,
      })
    } else if (!pagoYaRegistrado(movsList, `Venta ${ventaNumMap[p.venta_id]}`, p.monto)) {
      SYNTH.push({
        id: synId--, sesion_id: sesionId, tipo: 'ingreso',
        tipo_concepto: 'Pago venta',
        concepto: `Venta #${ventaNumMap[p.venta_id] ?? p.venta_id} — ${p.metodo}`,
        monto: Number(p.monto), usuario_id: '', created_at: p.created_at,
      })
    }
  }

  // Órdenes de venta
  for (const p of (ordenPagos ?? [])) {
    if (p.metodo === 'CUENTA_CORRIENTE' || p.metodo === 'NOTA_CREDITO') {
      SYNTH.push({
        id: synId--, sesion_id: sesionId, tipo: 'ingreso',
        tipo_concepto: p.metodo === 'CUENTA_CORRIENTE' ? 'Cuenta corriente' : 'Nota de crédito',
        concepto: `Orden de venta #${ordenNumMap[p.orden_id] ?? p.orden_id}`,
        monto: Number(p.monto), usuario_id: '', created_at: p.created_at,
      })
    } else if (!pagoYaRegistrado(movsList, `Orden ${ordenNumMap[p.orden_id]}`, p.monto)) {
      SYNTH.push({
        id: synId--, sesion_id: sesionId, tipo: 'ingreso',
        tipo_concepto: 'Pago orden',
        concepto: `Orden de venta #${ordenNumMap[p.orden_id] ?? p.orden_id} — ${p.metodo}`,
        monto: Number(p.monto), usuario_id: '', created_at: p.created_at,
      })
    }
  }

  // OT — deduplicar contra caja_movimientos (patrón: "OT {numero}")
  for (const p of (otPagosRaw ?? [])) {
    if (p.metodo === 'CUENTA_CORRIENTE' || p.metodo === 'NOTA_CREDITO') {
      SYNTH.push({
        id: synId--, sesion_id: sesionId, tipo: 'ingreso',
        tipo_concepto: p.metodo === 'CUENTA_CORRIENTE' ? 'Cuenta corriente' : 'Nota de crédito',
        concepto: `Orden de trabajo #${otNumMap[p.orden_id] ?? p.orden_id}`,
        monto: Number(p.monto), usuario_id: '', created_at: p.created_at,
      })
    } else if (!pagoYaRegistrado(movsList, `${otNumMap[p.orden_id]}`, p.monto)) {
      SYNTH.push({
        id: synId--, sesion_id: sesionId, tipo: 'ingreso',
        tipo_concepto: 'Pago OT',
        concepto: `Orden de trabajo #${otNumMap[p.orden_id] ?? p.orden_id} — ${p.metodo}`,
        monto: Number(p.monto), usuario_id: '', created_at: p.created_at,
      })
    }
  }

  // Servicios — deduplicar contra caja_movimientos (patrón: "SV {numero}")
  for (const p of (svPagosRaw ?? [])) {
    if (p.metodo === 'CUENTA_CORRIENTE' || p.metodo === 'NOTA_CREDITO') {
      SYNTH.push({
        id: synId--, sesion_id: sesionId, tipo: 'ingreso',
        tipo_concepto: p.metodo === 'CUENTA_CORRIENTE' ? 'Cuenta corriente' : 'Nota de crédito',
        concepto: `Servicio #${svNumMap[p.servicio_id] ?? p.servicio_id}`,
        monto: Number(p.monto), usuario_id: '', created_at: p.created_at,
      })
    } else if (!pagoYaRegistrado(movsList, `${svNumMap[p.servicio_id]}`, p.monto)) {
      SYNTH.push({
        id: synId--, sesion_id: sesionId, tipo: 'ingreso',
        tipo_concepto: 'Pago servicio',
        concepto: `Servicio #${svNumMap[p.servicio_id] ?? p.servicio_id} — ${p.metodo}`,
        monto: Number(p.monto), usuario_id: '', created_at: p.created_at,
      })
    }
  }

  // ── 7. Unir todo y ordenar ────────────────────────────────────────────────
  const all = [...movsList, ...SYNTH].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return NextResponse.json(all)
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('fondos.caja.movimiento')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()

  const tipo = body.tipo
  const tipo_concepto = body.tipo_concepto?.trim() || null
  const concepto = body.concepto?.trim() || ''
  const monto = parseFloat(body.monto ?? '0')

  if (!['ingreso', 'egreso'].includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  if (!tipo_concepto && !concepto) return NextResponse.json({ error: 'El concepto es obligatorio' }, { status: 400 })
  if (isNaN(monto) || monto <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })

  const { data: sesion } = await supabase
    .from('caja_sesiones')
    .select('estado, sucursal_id')
    .eq('id', id)
    .single()

  if (!sesion) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  const guard = await assertHomeSucursal(sesion.sucursal_id)
  if (guard) return guard

  if (sesion.estado !== 'abierta')
    return NextResponse.json({ error: 'La sesión no está abierta' }, { status: 400 })

  const { data, error } = await supabase
    .from('caja_movimientos')
    .insert({ sesion_id: Number(id), tipo, tipo_concepto, concepto, monto, usuario_id: session.user.id, vendedor_id: body.vendedor_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
