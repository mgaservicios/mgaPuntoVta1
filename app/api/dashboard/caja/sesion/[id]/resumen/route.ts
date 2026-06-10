import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

type Ctx = { params: Promise<{ id: string }> }

export const METODO_LABELS: Record<string, string> = {
  EFECTIVO:        'Efectivo',
  TRANSFERENCIA:   'Transferencia',
  TARJETA_DEBITO:  'Tarjeta débito',
  TARJETA_CREDITO: 'Tarjeta crédito',
  CHEQUE:          'Cheque',
  OTRO:            'Otro',
}

function groupByMetodo(rows: { metodo: string; monto: number }[]) {
  const map: Record<string, number> = {}
  for (const r of rows) {
    const key = r.metodo
    map[key] = (map[key] ?? 0) + Number(r.monto)
  }
  return Object.entries(map)
    .map(([metodo, monto]) => ({ metodo, label: METODO_LABELS[metodo] ?? metodo, monto }))
    .sort((a, b) => b.monto - a.monto)
}

export async function GET(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const sesionId = Number(id)

  // Datos de la sesión para filtrar por rango de fechas
  const { data: sesionData, error: sesionErr } = await supabase
    .from('caja_sesiones')
    .select('fecha_apertura, fecha_cierre, sucursal_id, monto_apertura')
    .eq('id', sesionId)
    .single()

  if (sesionErr || !sesionData)
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  const desde = sesionData.fecha_apertura
  const hasta  = sesionData.fecha_cierre ?? new Date().toISOString()

  // ── Ventas POS ─────────────────────────────────────────────────────────────
  const { data: ventasRows } = await supabase
    .from('ventas')
    .select('id')
    .eq('caja_sesion_id', sesionId)
    .neq('estado', 'anulada')

  const ventaIds = (ventasRows ?? []).map(v => v.id)

  const { data: ventaPagos } = ventaIds.length > 0
    ? await supabase
        .from('venta_pagos')
        .select('metodo, monto')
        .in('venta_id', ventaIds)
        .neq('metodo', 'NOTA_CREDITO')
    : { data: [] as { metodo: string; monto: number }[] }

  // ── Órdenes de venta (por rango de fecha ya que no tienen caja_sesion_id) ──
  const { data: ordenesRows } = await supabase
    .from('ordenes_venta')
    .select('id')
    .eq('sucursal_id', sesionData.sucursal_id)
    .neq('estado', 'anulada')

  const ordenIds = (ordenesRows ?? []).map(o => o.id)

  const { data: ordPagos } = ordenIds.length > 0
    ? await supabase
        .from('orden_venta_pagos')
        .select('metodo, monto')
        .in('orden_id', ordenIds)
        .gte('created_at', desde)
        .lte('created_at', hasta)
        .neq('metodo', 'NOTA_CREDITO')
    : { data: [] as { metodo: string; monto: number }[] }

  // ── OT ─────────────────────────────────────────────────────────────────────
  const { data: otPagos } = await supabase
    .from('optica_orden_pagos')
    .select('metodo, monto')
    .eq('caja_sesion_id', sesionId)

  // ── Servicios ──────────────────────────────────────────────────────────────
  const { data: svPagos } = await supabase
    .from('optica_servicio_pagos')
    .select('metodo, monto')
    .eq('caja_sesion_id', sesionId)

  // ── Movimientos manuales de caja (ingresos y egresos, sin Apertura) ────────
  const { data: movs } = await supabase
    .from('caja_movimientos')
    .select('tipo, tipo_concepto, monto')
    .eq('sesion_id', sesionId)
    .neq('tipo_concepto', 'Apertura')

  const manualIng = (movs ?? [])
    .filter(m => m.tipo === 'ingreso')
    .reduce((s, m) => s + Number(m.monto), 0)
  const manualEgr = (movs ?? [])
    .filter(m => m.tipo === 'egreso')
    .reduce((s, m) => s + Number(m.monto), 0)

  return NextResponse.json({
    ventas:    groupByMetodo((ventaPagos ?? []) as { metodo: string; monto: number }[]),
    ordenes:   groupByMetodo((ordPagos   ?? []) as { metodo: string; monto: number }[]),
    ot:        groupByMetodo((otPagos    ?? []) as { metodo: string; monto: number }[]),
    servicios: groupByMetodo((svPagos    ?? []) as { metodo: string; monto: number }[]),
    apertura:  Number(sesionData.monto_apertura ?? 0),
    manualIng,
    manualEgr,
  })
}
