import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/services/supabase-tenant'
import { adjustArticuloStock, syncArticuloStock } from '@/services/stock'
import { requirePermission } from '@/lib/require-permission'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, { params }: Ctx) {
  const session = await requirePermission('inventario.remitos.anular')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data: remito, error } = await supabase
    .from('remitos')
    .select(`id, tipo, sucursal_id, estado, contraparte_tipo, contraparte_sucursal_id,
      remito_items(articulo_id, variante_id, cantidad)`)
    .eq('id', id)
    .single()

  if (error || !remito) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (remito.estado !== 'confirmado') return NextResponse.json({ error: 'Solo se pueden anular remitos confirmados' }, { status: 400 })

  const items = Array.isArray(remito.remito_items) ? remito.remito_items : []

  // Reversa: delta opuesto al tipo original
  const delta = remito.tipo === 'entrada' ? -1 : 1
  const articuloIds = new Set<number>()

  for (const item of items) {
    const stockErr = await adjustArticuloStock(
      item.articulo_id,
      item.variante_id ?? null,
      remito.sucursal_id,
      delta * item.cantidad,
      supabase,
    )
    if (stockErr) return NextResponse.json({ error: `Error revirtiendo stock: ${stockErr}` }, { status: 500 })
    articuloIds.add(item.articulo_id)
  }

  for (const aid of articuloIds) await syncArticuloStock(aid, supabase)

  await supabase
    .from('remitos')
    .update({ estado: 'anulado', updated_at: new Date().toISOString() })
    .eq('id', id)

  // ── Salida hacia Sucursal: anular también el remito de entrada vinculado ──
  if (remito.tipo === 'salida' && remito.contraparte_tipo === 'sucursal' && remito.contraparte_sucursal_id) {
    const { data: remitoEntrada } = await supabase
      .from('remitos')
      .select(`id, sucursal_id, estado, remito_items(articulo_id, variante_id, cantidad)`)
      .eq('remito_origen_id', remito.id)
      .eq('tipo', 'entrada')
      .maybeSingle()

    if (remitoEntrada && remitoEntrada.estado === 'confirmado') {
      const entradaItems = Array.isArray(remitoEntrada.remito_items) ? remitoEntrada.remito_items : []
      const articuloIdsDestino = new Set<number>()

      for (const item of entradaItems) {
        const err = await adjustArticuloStock(
          item.articulo_id,
          item.variante_id ?? null,
          remitoEntrada.sucursal_id,
          -item.cantidad, // reversa de entrada
          supabase,
        )
        if (err) return NextResponse.json({
          ok: true,
          warning: `Remito anulado pero error al revertir stock en sucursal destino: ${err}`,
        })
        articuloIdsDestino.add(item.articulo_id)
      }

      for (const aid of articuloIdsDestino) await syncArticuloStock(aid, supabase)

      await supabase
        .from('remitos')
        .update({ estado: 'anulado', updated_at: new Date().toISOString() })
        .eq('id', remitoEntrada.id)
    }
  }

  return NextResponse.json({ ok: true })
}
