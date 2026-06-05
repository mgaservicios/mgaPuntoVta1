import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

type Ctx = { params: Promise<{ id: string }> }

const METODO_LABELS: Record<string, string> = {
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

  // ── Ventas POS de la sesión (excluye CC y NC que no pasan por caja) ────────
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
        .not('metodo', 'in', '("CUENTA_CORRIENTE","NOTA_CREDITO")')
    : { data: [] as { metodo: string; monto: number }[] }

  // ── OT de la sesión ────────────────────────────────────────────────────────
  const { data: otPagos } = await supabase
    .from('optica_orden_pagos')
    .select('metodo, monto')
    .eq('caja_sesion_id', sesionId)

  // ── Servicios de la sesión ─────────────────────────────────────────────────
  const { data: svPagos } = await supabase
    .from('optica_servicio_pagos')
    .select('metodo, monto')
    .eq('caja_sesion_id', sesionId)

  return NextResponse.json({
    ventas:    groupByMetodo((ventaPagos ?? []) as { metodo: string; monto: number }[]),
    ot:        groupByMetodo((otPagos    ?? []) as { metodo: string; monto: number }[]),
    servicios: groupByMetodo((svPagos    ?? []) as { metodo: string; monto: number }[]),
  })
}
