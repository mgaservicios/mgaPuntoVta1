import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { adjustArticuloStock, syncArticuloStock } from '@/services/stock'
import { assertHomeSucursal } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, { params }: Ctx) {
  const session = await requirePermission('ventas.historial.anular')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data: venta, error } = await supabase
    .from('ventas')
    .select('id, estado, numero, cliente_id, caja_sesion_id, sucursal_id, venta_items(articulo_id, variante_id, cantidad), venta_pagos(metodo, monto, nota_credito_id)')
    .eq('id', id)
    .single()

  if (error || !venta) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const guard = await assertHomeSucursal(venta.sucursal_id)
  if (guard) return guard

  if (venta.estado !== 'completada') return NextResponse.json({ error: 'Solo se pueden anular ventas completadas' }, { status: 400 })
  if (!venta.sucursal_id) return NextResponse.json({ error: 'La venta no tiene sucursal registrada (datos históricos)' }, { status: 400 })

  const items = Array.isArray(venta.venta_items) ? venta.venta_items : []

  // Revertir stock por sucursal
  const articuloIdsSet = new Set<number>()
  for (const item of items) {
    const stockErr = await adjustArticuloStock(
      item.articulo_id,
      item.variante_id ?? null,
      venta.sucursal_id,
      item.cantidad,
      supabase,
    )
    if (stockErr) return NextResponse.json({ error: `Error revirtiendo stock: ${stockErr}` }, { status: 500 })
    articuloIdsSet.add(item.articulo_id)
  }
  for (const aid of articuloIdsSet) await syncArticuloStock(aid, supabase)

  const pagos = Array.isArray(venta.venta_pagos) ? venta.venta_pagos : []

  // Restaurar saldo de notas de crédito
  const pagosNC = pagos.filter((p: { metodo: string }) => p.metodo === 'NOTA_CREDITO') as { metodo: string; monto: number; nota_credito_id: number }[]
  for (const p of pagosNC) {
    if (!p.nota_credito_id) continue
    const { data: nc } = await supabase
      .from('notas_credito').select('monto_disponible, monto').eq('id', p.nota_credito_id).single()
    if (nc) {
      const nuevo = Math.min(Number(nc.monto), Number(nc.monto_disponible) + p.monto)
      await supabase.from('notas_credito').update({
        monto_disponible: nuevo,
        estado: 'pendiente',
        updated_at: new Date().toISOString(),
      }).eq('id', p.nota_credito_id)
    }
  }

  // Revertir cobranza de cuenta corriente si existía
  const pagoCC = pagos.find((p: { metodo: string }) => p.metodo === 'CUENTA_CORRIENTE')
  if (pagoCC && venta.cliente_id) {
    await supabase.from('cobranzas').insert({
      cliente_id: venta.cliente_id,
      venta_id: venta.id,
      tipo: 'PAGO',
      monto: pagoCC.monto,
      fecha: new Date().toISOString().slice(0, 10),
      descripcion: `Anulación venta ${venta.numero}`,
      sucursal_id: venta.sucursal_id,
      usuario_id: session.user.id,
    })
  }

  // Revertir movimientos de caja (no CC)
  const METODO_LABELS: Record<string, string> = {
    EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia',
    TARJETA_DEBITO: 'Tarjeta débito', TARJETA_CREDITO: 'Tarjeta crédito',
    CHEQUE: 'Cheque', OTRO: 'Otro',
  }

  // Determinar sesión de caja destino: si la original sigue abierta usar esa, si no la actual
  let sesionCajaTarget = venta.caja_sesion_id as number | null
  if (sesionCajaTarget) {
    const { data: sesionCheck } = await supabase
      .from('caja_sesiones').select('estado').eq('id', sesionCajaTarget).single()
    if (sesionCheck?.estado !== 'abierta') {
      const { data: sesionActual } = await supabase
        .from('caja_sesiones').select('id')
        .eq('sucursal_id', venta.sucursal_id)
        .eq('estado', 'abierta')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      sesionCajaTarget = sesionActual?.id ?? null
    }
  }

  const pagosNoCc = pagos.filter(p => p.metodo !== 'CUENTA_CORRIENTE')
  if (sesionCajaTarget && pagosNoCc.length > 0) {
    for (const p of pagosNoCc) {
      await supabase.from('caja_movimientos').insert({
        sesion_id: sesionCajaTarget,
        tipo: 'egreso',
        concepto: `Anulación venta ${venta.numero} - ${METODO_LABELS[p.metodo] ?? p.metodo}`,
        monto: p.monto,
        usuario_id: session.user.id,
      })
    }
  }

  await supabase
    .from('ventas')
    .update({ estado: 'anulada', updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
