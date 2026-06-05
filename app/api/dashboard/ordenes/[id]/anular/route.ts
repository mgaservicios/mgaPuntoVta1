import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/services/supabase-tenant'
import { adjustArticuloStock, syncArticuloStock } from '@/services/stock'
import { getActiveSucursalId } from '@/lib/sucursal'
import { METODO_ORDEN_LABELS } from '@/types/ordenes'
import { requirePermission } from '@/lib/require-permission'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, { params }: Ctx) {
  const session = await requirePermission('ventas.ordenes.anular')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data: orden, error } = await supabase
    .from('ordenes_venta')
    .select('*, orden_venta_items(articulo_id, variante_id, cantidad), orden_venta_pagos(metodo, monto, nota_credito_id)')
    .eq('id', id)
    .single()

  if (error || !orden) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (orden.estado === 'anulada') return NextResponse.json({ error: 'La orden ya está anulada' }, { status: 400 })

  const items = Array.isArray(orden.orden_venta_items) ? orden.orden_venta_items : []
  const pagos = Array.isArray(orden.orden_venta_pagos) ? orden.orden_venta_pagos : []

  if (orden.estado === 'confirmada') {
    // Restaurar saldo de notas de crédito
    const pagosNC = pagos.filter((p: { metodo: string }) => p.metodo === 'NOTA_CREDITO') as { metodo: string; monto: number; nota_credito_id?: number }[]
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

    // Sucursal: usar la guardada; fallback a activa (para órdenes históricas)
    const sucursalId = orden.sucursal_id ?? await getActiveSucursalId()
    if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

    // Revertir stock + registrar movimiento
    const articuloIdsSet = new Set<number>()
    for (const item of items) {
      const vid = item.variante_id ?? null

      let sqQ = supabase
        .from('articulo_stock')
        .select('stock_actual')
        .eq('articulo_id', item.articulo_id)
        .eq('sucursal_id', sucursalId)
      sqQ = vid === null ? sqQ.is('variante_id', null) : sqQ.eq('variante_id', vid)
      const { data: sqRow } = await sqQ.maybeSingle()
      const stockAntes = Number(sqRow?.stock_actual ?? 0)

      const stockErr = await adjustArticuloStock(item.articulo_id, vid, sucursalId, item.cantidad, supabase)
      if (stockErr) return NextResponse.json({ error: `Error revirtiendo stock: ${stockErr}` }, { status: 500 })
      articuloIdsSet.add(item.articulo_id)

      await supabase.from('movimientos_stock').insert({
        articulo_id: item.articulo_id,
        variante_id: vid,
        sucursal_id: sucursalId,
        tipo: 'devolucion',
        cantidad: item.cantidad,
        stock_antes: stockAntes,
        stock_despues: stockAntes + item.cantidad,
        referencia: orden.numero,
        observaciones: `Anulación orden ${orden.numero}`,
        usuario_id: session.user.id,
      })
    }
    for (const aid of articuloIdsSet) await syncArticuloStock(aid, supabase)

    // Revertir cobranza de cuenta corriente
    const pagoCC = pagos.find((p: { metodo: string }) => p.metodo === 'CUENTA_CORRIENTE')
    if (pagoCC && orden.cliente_id) {
      await supabase.from('cobranzas').insert({
        cliente_id: orden.cliente_id,
        tipo: 'PAGO',
        monto: (pagoCC as { monto: number }).monto,
        fecha: new Date().toISOString().slice(0, 10),
        descripcion: `Anulación orden ${orden.numero}`,
        usuario_id: session.user.id,
      })
    }

    // Revertir movimientos de caja (no CC)
    const pagosNoCc = pagos.filter((p: { metodo: string }) => p.metodo !== 'CUENTA_CORRIENTE') as { metodo: string; monto: number }[]
    if (pagosNoCc.length > 0) {
      let { data: cajaSesion } = await supabase
        .from('caja_sesiones')
        .select('id')
        .eq('estado', 'abierta')
        .maybeSingle()

      if (!cajaSesion) {
        const { data: nueva } = await supabase
          .from('caja_sesiones')
          .insert({ usuario_id: session.user.id, monto_apertura: 0 })
          .select('id')
          .single()
        cajaSesion = nueva
      }

      if (cajaSesion) {
        for (const p of pagosNoCc) {
          const metodoLabel = METODO_ORDEN_LABELS[p.metodo as keyof typeof METODO_ORDEN_LABELS] ?? p.metodo
          await supabase.from('caja_movimientos').insert({
            sesion_id: cajaSesion.id,
            tipo: 'egreso',
            concepto: `Anulación orden ${orden.numero} - ${metodoLabel}`,
            monto: p.monto,
            usuario_id: session.user.id,
          })
        }
      }
    }
  }

  await supabase
    .from('ordenes_venta')
    .update({ estado: 'anulada', updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
