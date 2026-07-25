import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { syncArticuloStock } from '@/services/stock'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'Administrador') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
  }

  const supabase = await getTenantClient(session)
  const { id } = await params
  const articuloId = Number(id)

  const { data: articulo } = await supabase
    .from('articulos')
    .select('id')
    .eq('id', articuloId)
    .single()

  if (!articulo) return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })

  const body = await req.json()
  const stockEntries: { sucursal_id: number; cantidad: number }[] = body.stock ?? []

  const validEntries = stockEntries.filter(e => e.cantidad > 0)
  if (validEntries.length === 0) {
    return NextResponse.json({ ok: true, remitos: 0 })
  }

  const remitosCreados: { id: number; numero: string; sucursal_id: number; cantidad: number }[] = []
  const errors: { sucursal_id: number; error: string }[] = []

  for (const entry of validEntries) {
    const { sucursal_id, cantidad } = entry

    const { data: sucursal } = await supabase
      .from('sucursales')
      .select('nombre')
      .eq('id', sucursal_id)
      .single()

    const { data: nextNum } = await supabase.rpc('next_numero_sucursal', {
      p_sucursal_id: sucursal_id,
      p_tipo: 'remito_entrada',
    })

    const numero = `E-${String(sucursal_id).padStart(2, '0')}-${String(nextNum).padStart(5, '0')}`

    const { data: remito, error: errRemito } = await supabase
      .from('remitos')
      .insert({
        numero,
        tipo: 'entrada',
        sucursal_id,
        contraparte_tipo: 'persona',
        contraparte_nombre: sucursal?.nombre ?? `Sucursal ${sucursal_id}`,
        fecha: new Date().toISOString(),
        observaciones: 'Stock inicial — carga rápida desde artículo nuevo',
        estado: 'confirmado',
        created_by: session.user.id,
      })
      .select('id')
      .single()

    if (errRemito || !remito) {
      errors.push({ sucursal_id, error: errRemito?.message ?? 'Error creando remito' })
      continue
    }

    const { error: errItems } = await supabase.from('remito_items').insert({
      remito_id: remito.id,
      articulo_id: articuloId,
      variante_id: null,
      cantidad,
    })

    if (errItems) {
      await supabase.from('remitos').delete().eq('id', remito.id)
      errors.push({ sucursal_id, error: errItems.message })
      continue
    }

    const { data: existing } = await supabase
      .from('articulo_stock')
      .select('id, stock_actual')
      .eq('articulo_id', articuloId)
      .eq('sucursal_id', sucursal_id)
      .is('variante_id', null)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('articulo_stock')
        .update({ stock_actual: Number(existing.stock_actual) + cantidad })
        .eq('id', existing.id)
    } else {
      await supabase.from('articulo_stock').insert({
        articulo_id: articuloId,
        variante_id: null,
        sucursal_id,
        stock_actual: cantidad,
        stock_minimo: 0,
      })
    }

    remitosCreados.push({ id: remito.id, numero, sucursal_id, cantidad })
  }

  await syncArticuloStock(articuloId, supabase)

  return NextResponse.json({
    ok: true,
    remitos: remitosCreados.length,
    remitos_creados: remitosCreados,
    errors: errors.length > 0 ? errors : undefined,
  })
}
