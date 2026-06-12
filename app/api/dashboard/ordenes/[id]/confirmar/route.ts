import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/services/supabase-tenant'
import { adjustArticuloStock, syncArticuloStock, validarStockSuficiente } from '@/services/stock'
import { getHomeSucursalId, assertHomeSucursal } from '@/lib/sucursal'
import { METODO_ORDEN_LABELS } from '@/types/ordenes'
import { requirePermission } from '@/lib/require-permission'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, { params }: Ctx) {
  const session = await requirePermission('ventas.ordenes.confirmar')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data: orden, error } = await supabase
    .from('ordenes_venta')
    .select('*, orden_venta_items(articulo_id, variante_id, cantidad), orden_venta_pagos(metodo, monto, nota_credito_id)')
    .eq('id', id)
    .single()

  if (error || !orden) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const guard = await assertHomeSucursal(orden.sucursal_id)
  if (guard) return guard

  if (orden.estado !== 'borrador') return NextResponse.json({ error: 'Solo se pueden confirmar órdenes en borrador' }, { status: 400 })

  const items = Array.isArray(orden.orden_venta_items) ? orden.orden_venta_items : []
  if (items.length === 0) return NextResponse.json({ error: 'La orden no tiene ítems' }, { status: 400 })

  const pagos = Array.isArray(orden.orden_venta_pagos) ? orden.orden_venta_pagos : []
  const pagoCC = pagos.find((p: { metodo: string }) => p.metodo === 'CUENTA_CORRIENTE')
  if (pagoCC && !orden.cliente_id) {
    return NextResponse.json({ error: 'Se requiere un cliente para usar Cuenta corriente' }, { status: 400 })
  }

  // Validar notas de crédito antes de descontar stock
  const pagosNC = pagos.filter((p: { metodo: string }) => p.metodo === 'NOTA_CREDITO') as { metodo: string; monto: number; nota_credito_id?: number }[]
  for (const p of pagosNC) {
    if (!p.nota_credito_id) return NextResponse.json({ error: 'Pago con nota de crédito sin id' }, { status: 400 })
    const { data: nc } = await supabase
      .from('notas_credito').select('monto_disponible, estado').eq('id', p.nota_credito_id).single()
    if (!nc || nc.estado === 'anulada') return NextResponse.json({ error: `Nota de crédito ${p.nota_credito_id} no válida` }, { status: 400 })
    if (Number(nc.monto_disponible) < p.monto - 0.001) return NextResponse.json({ error: `Saldo insuficiente en nota de crédito` }, { status: 400 })
  }

  // Sucursal: usar la guardada en la orden; fallback a la activa (para órdenes históricas sin sucursal_id)
  const sucursalId = orden.sucursal_id ?? await getHomeSucursalId()
  if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  if (Number(orden.total) <= 0) return NextResponse.json({ error: 'El total de la orden debe ser mayor a cero' }, { status: 400 })

  // Validar stock antes de descontar (solo items con cantidad positiva; los negativos reingresan stock)
  const stockValidErr = await validarStockSuficiente(
    items.filter((i: { cantidad: number }) => i.cantidad > 0).map((i: { articulo_id: number; variante_id: number | null; cantidad: number }) => ({ articulo_id: i.articulo_id, variante_id: i.variante_id ?? null, cantidad: i.cantidad })),
    sucursalId,
    supabase,
  )
  if (stockValidErr) return NextResponse.json({ error: stockValidErr }, { status: 400 })

  // Descontar stock por sucursal + registrar movimiento
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

    const stockErr = await adjustArticuloStock(item.articulo_id, vid, sucursalId, -item.cantidad, supabase)
    if (stockErr) return NextResponse.json({ error: `Error ajustando stock: ${stockErr}` }, { status: 500 })
    articuloIdsSet.add(item.articulo_id)

    await supabase.from('movimientos_stock').insert({
      articulo_id: item.articulo_id,
      variante_id: vid,
      sucursal_id: sucursalId,
      tipo: item.cantidad < 0 ? 'devolucion' : 'orden',
      cantidad: item.cantidad,
      stock_antes: stockAntes,
      stock_despues: stockAntes - item.cantidad,
      referencia: orden.numero,
      usuario_id: session.user.id,
    })
  }
  for (const aid of articuloIdsSet) await syncArticuloStock(aid, supabase)

  // Descontar saldo de notas de crédito
  for (const p of pagosNC) {
    const { data: nc } = await supabase
      .from('notas_credito').select('monto_disponible').eq('id', p.nota_credito_id!).single()
    if (nc) {
      const nuevo = Math.max(0, Number(nc.monto_disponible) - p.monto)
      await supabase.from('notas_credito').update({
        monto_disponible: nuevo,
        estado: nuevo <= 0 ? 'utilizada' : 'pendiente',
        updated_at: new Date().toISOString(),
      }).eq('id', p.nota_credito_id!)
    }
  }

  // Cobranza por cuenta corriente
  if (pagoCC && orden.cliente_id) {
    await supabase.from('cobranzas').insert({
      cliente_id: orden.cliente_id,
      tipo: 'CARGO',
      monto: pagoCC.monto,
      fecha: orden.fecha,
      descripcion: `Orden de venta ${orden.numero}`,
      sucursal_id: orden.sucursal_id,
      usuario_id: session.user.id,
    })
  }

  // Movimientos de caja para métodos que no son cuenta corriente
  const pagosNoCc = pagos.filter((p: { metodo: string; monto: number }) => p.metodo !== 'CUENTA_CORRIENTE')

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
          tipo: 'ingreso',
          concepto: `Orden ${orden.numero} - ${metodoLabel}`,
          monto: p.monto,
          usuario_id: session.user.id,
        })
      }
    }
  }

  await supabase
    .from('ordenes_venta')
    .update({ estado: 'confirmada', updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
