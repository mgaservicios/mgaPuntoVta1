import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getHomeSucursalId, assertActiveSucursalIsHome } from '@/lib/sucursal'

const ROLES_ESCRITURA = ['Administrador', 'Supervisor']
const PROVEEDOR_STOCK_INICIAL = 2
const ITEMS_POR_REMITO = 50
const PARALLEL = 10

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ROLES_ESCRITURA.includes(session.user.role))
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const guardErr = await assertActiveSucursalIsHome()
  if (guardErr) return guardErr

  const sucursalId = await getHomeSucursalId()
  if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const { rows } = await req.json() as { rows: { artCodigo: string; stock: number }[] }
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'Sin filas' }, { status: 400 })

  const errors: { codigo: string; error: string }[] = []

  // Batch-lookup articulo_ids
  const codigos = [...new Set(rows.map(r => r.artCodigo?.trim()).filter(Boolean))]
  const { data: articulos, error: artErr } = await supabase
    .from('articulos')
    .select('id, codigo')
    .in('codigo', codigos)
  if (artErr) return NextResponse.json({ error: artErr.message }, { status: 500 })

  const codigoToId = Object.fromEntries((articulos ?? []).map(a => [a.codigo, a.id]))

  // Build valid items
  const items: { articuloId: number; codigo: string; stock: number }[] = []
  for (const r of rows) {
    const codigo = r.artCodigo?.trim()
    const articuloId = codigoToId[codigo]
    if (!articuloId) { errors.push({ codigo: codigo ?? '', error: 'Artículo no encontrado' }); continue }
    const stock = Number(r.stock)
    if (isNaN(stock) || stock <= 0) { errors.push({ codigo, error: 'Stock inválido' }); continue }
    items.push({ articuloId, codigo, stock })
  }

  if (items.length === 0) return NextResponse.json({ ok: 0, remitos: 0, errors })

  let okCount = 0
  let remitoCount = 0

  // Process in batches of ITEMS_POR_REMITO
  for (let i = 0; i < items.length; i += ITEMS_POR_REMITO) {
    const batch = items.slice(i, i + ITEMS_POR_REMITO)

    // Generate remito number
    const { count } = await supabase.from('remitos').select('id', { count: 'exact', head: true })
    const numero = `E-${String((count ?? 0) + 1).padStart(5, '0')}`

    // Create remito
    const { data: remito, error: errRemito } = await supabase
      .from('remitos')
      .insert({
        numero,
        tipo: 'entrada',
        sucursal_id: sucursalId,
        contraparte_tipo: 'proveedor',
        contraparte_proveedor_id: PROVEEDOR_STOCK_INICIAL,
        fecha: new Date().toISOString(),
        observaciones: 'Importación stock inicial óptica',
        estado: 'confirmado',
        created_by: session.user.id,
      })
      .select('id')
      .single()

    if (errRemito || !remito) {
      for (const it of batch) errors.push({ codigo: it.codigo, error: errRemito?.message ?? 'Error creando remito' })
      continue
    }

    // Insert remito_items
    const { error: errItems } = await supabase.from('remito_items').insert(
      batch.map(it => ({
        remito_id: remito.id,
        articulo_id: it.articuloId,
        variante_id: null,
        cantidad: it.stock,
      }))
    )
    if (errItems) {
      await supabase.from('remitos').delete().eq('id', remito.id)
      for (const it of batch) errors.push({ codigo: it.codigo, error: errItems.message })
      continue
    }

    remitoCount++

    // Adjust articulo_stock (bulk-optimized)
    const batchArtIds = batch.map(it => it.articuloId)

    const { data: existingStock } = await supabase
      .from('articulo_stock')
      .select('id, articulo_id, stock_actual')
      .in('articulo_id', batchArtIds)
      .eq('sucursal_id', sucursalId)
      .is('variante_id', null)

    const stockMap = new Map((existingStock ?? []).map(r => [r.articulo_id, r]))

    const toInsert: { articulo_id: number; variante_id: null; sucursal_id: number; stock_actual: number; stock_minimo: number }[] = []
    const toUpdate: { id: number; stock_actual: number }[] = []

    for (const it of batch) {
      const existing = stockMap.get(it.articuloId)
      if (existing) {
        toUpdate.push({ id: existing.id, stock_actual: Number(existing.stock_actual) + it.stock })
      } else {
        toInsert.push({ articulo_id: it.articuloId, variante_id: null, sucursal_id: sucursalId, stock_actual: it.stock, stock_minimo: 0 })
      }
    }

    if (toInsert.length > 0) await supabase.from('articulo_stock').insert(toInsert)

    for (let j = 0; j < toUpdate.length; j += PARALLEL) {
      await Promise.all(
        toUpdate.slice(j, j + PARALLEL).map(u =>
          supabase.from('articulo_stock').update({ stock_actual: u.stock_actual }).eq('id', u.id)
        )
      )
    }

    // Sync articulos.stock_actual (sum across all sucursales per articulo)
    const { data: stockTotals } = await supabase
      .from('articulo_stock')
      .select('articulo_id, stock_actual')
      .in('articulo_id', batchArtIds)
      .is('variante_id', null)

    const totalMap = new Map<number, number>()
    for (const s of stockTotals ?? []) {
      totalMap.set(s.articulo_id, (totalMap.get(s.articulo_id) ?? 0) + Number(s.stock_actual))
    }

    const totalEntries = Array.from(totalMap.entries())
    for (let j = 0; j < totalEntries.length; j += PARALLEL) {
      await Promise.all(
        totalEntries.slice(j, j + PARALLEL).map(([id, stock_actual]) =>
          supabase.from('articulos').update({ stock_actual }).eq('id', id)
        )
      )
    }

    okCount += batch.length
  }

  return NextResponse.json({ ok: okCount, remitos: remitoCount, errors })
}
