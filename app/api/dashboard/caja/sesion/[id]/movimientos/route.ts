import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { assertHomeSucursal } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

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

  const { data: movs, error } = await supabase
    .from('caja_movimientos')
    .select('*')
    .eq('sesion_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Pagos CC — Ventas POS ──────────────────────────────────────────────────
  const { data: ventasRows } = await supabase
    .from('ventas')
    .select('id, numero')
    .eq('caja_sesion_id', sesionId)
    .neq('estado', 'anulada')

  const ventaIds = (ventasRows ?? []).map(v => v.id)
  const ventaNumMap = Object.fromEntries((ventasRows ?? []).map(v => [v.id, v.numero]))

  const { data: ventaCC } = ventaIds.length > 0
    ? await supabase.from('venta_pagos').select('id, venta_id, monto, created_at').in('venta_id', ventaIds).eq('metodo', 'CUENTA_CORRIENTE')
    : { data: [] as { id: number; venta_id: number; monto: number; created_at: string }[] }

  // ── Pagos CC — Órdenes de venta ────────────────────────────────────────────
  const { data: ordenesRows } = sucursalId
    ? await supabase.from('ordenes_venta').select('id, numero').eq('sucursal_id', sucursalId).neq('estado', 'anulada')
    : { data: [] as { id: number; numero: number }[] }

  const ordenIds = (ordenesRows ?? []).map(o => o.id)
  const ordenNumMap = Object.fromEntries((ordenesRows ?? []).map(o => [o.id, o.numero]))

  const { data: ordenCC } = ordenIds.length > 0
    ? await supabase.from('orden_venta_pagos').select('id, orden_id, monto, created_at').in('orden_id', ordenIds).gte('created_at', desde).lte('created_at', hasta).eq('metodo', 'CUENTA_CORRIENTE')
    : { data: [] as { id: number; orden_id: number; monto: number; created_at: string }[] }

  // ── Pagos CC — OT ──────────────────────────────────────────────────────────
  const { data: otCCRaw } = await supabase
    .from('optica_orden_pagos')
    .select('id, orden_id, monto, created_at')
    .eq('caja_sesion_id', sesionId)
    .eq('metodo', 'CUENTA_CORRIENTE')

  const otOrdenIds = [...new Set((otCCRaw ?? []).map(p => p.orden_id))]
  const { data: otOrdenes } = otOrdenIds.length > 0
    ? await supabase.from('optica_ordenes').select('id, numero').in('id', otOrdenIds)
    : { data: [] as { id: number; numero: number }[] }
  const otNumMap = Object.fromEntries((otOrdenes ?? []).map(o => [o.id, o.numero]))

  // ── Pagos CC — Servicios ───────────────────────────────────────────────────
  const { data: svCCRaw } = await supabase
    .from('optica_servicio_pagos')
    .select('id, servicio_id, monto, created_at')
    .eq('caja_sesion_id', sesionId)
    .eq('metodo', 'CUENTA_CORRIENTE')

  const svIds = [...new Set((svCCRaw ?? []).map(p => p.servicio_id))]
  const { data: svOrdenes } = svIds.length > 0
    ? await supabase.from('optica_servicios').select('id, numero').in('id', svIds)
    : { data: [] as { id: number; numero: number }[] }
  const svNumMap = Object.fromEntries((svOrdenes ?? []).map(s => [s.id, s.numero]))

  // ── Armar entradas sintéticas CC ───────────────────────────────────────────
  let synId = -1
  const ccEntries = [
    ...(ventaCC ?? []).map(p => ({
      id: synId--, sesion_id: sesionId, tipo: 'ingreso' as const,
      tipo_concepto: 'Cuenta corriente', concepto: `Venta #${ventaNumMap[p.venta_id] ?? p.venta_id}`,
      monto: Number(p.monto), usuario_id: '', created_at: p.created_at,
    })),
    ...(ordenCC ?? []).map(p => ({
      id: synId--, sesion_id: sesionId, tipo: 'ingreso' as const,
      tipo_concepto: 'Cuenta corriente', concepto: `Orden de venta #${ordenNumMap[p.orden_id] ?? p.orden_id}`,
      monto: Number(p.monto), usuario_id: '', created_at: p.created_at,
    })),
    ...(otCCRaw ?? []).map(p => ({
      id: synId--, sesion_id: sesionId, tipo: 'ingreso' as const,
      tipo_concepto: 'Cuenta corriente', concepto: `Orden de trabajo #${otNumMap[p.orden_id] ?? p.orden_id}`,
      monto: Number(p.monto), usuario_id: '', created_at: p.created_at,
    })),
    ...(svCCRaw ?? []).map(p => ({
      id: synId--, sesion_id: sesionId, tipo: 'ingreso' as const,
      tipo_concepto: 'Cuenta corriente', concepto: `Servicio #${svNumMap[p.servicio_id] ?? p.servicio_id}`,
      monto: Number(p.monto), usuario_id: '', created_at: p.created_at,
    })),
  ]

  const all = [...(movs ?? []), ...ccEntries].sort(
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
