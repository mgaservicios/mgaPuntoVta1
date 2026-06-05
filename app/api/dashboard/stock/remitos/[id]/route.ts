import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { adjustArticuloStock, syncArticuloStock } from '@/services/stock'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data, error } = await supabase
    .from('remitos')
    .select(`
      *,
      remito_items(
        id, articulo_id, variante_id, cantidad, costo_unitario,
        articulos(codigo, nombre),
        articulo_variantes(sku)
      )
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const [sucursalRes, contraparteRes] = await Promise.all([
    supabase.from('sucursales').select('nombre').eq('id', data.sucursal_id).single(),
    data.contraparte_tipo === 'proveedor' && data.contraparte_proveedor_id
      ? supabase.from('proveedores').select('nombre').eq('id', data.contraparte_proveedor_id).single()
      : data.contraparte_tipo === 'sucursal' && data.contraparte_sucursal_id
      ? supabase.from('sucursales').select('nombre').eq('id', data.contraparte_sucursal_id).single()
      : Promise.resolve({ data: null }),
  ])

  const contraparte_display =
    data.contraparte_tipo === 'persona' ? (data.contraparte_nombre ?? '—') :
    (contraparteRes.data as { nombre: string } | null)?.nombre ?? '—'

  return NextResponse.json({
    ...data,
    sucursal_nombre: (sucursalRes.data as { nombre: string } | null)?.nombre ?? '—',
    contraparte_display,
  })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const { data: remito } = await supabase
    .from('remitos')
    .select(`estado, tipo, sucursal_id, contraparte_tipo, contraparte_sucursal_id,
      remito_items(articulo_id, variante_id, cantidad)`)
    .eq('id', id)
    .single()
  if (!remito) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (remito.estado === 'anulado') return NextResponse.json({ error: 'No se puede editar un remito anulado' }, { status: 400 })

  const { observaciones, items } = await req.json()

  await supabase
    .from('remitos')
    .update({ observaciones: observaciones?.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (!Array.isArray(items)) return NextResponse.json({ ok: true })

  type ItemInput = { articulo_id: number; variante_id?: number | null; cantidad: number; costo_unitario?: number | null }
  const newItems = items as ItemInput[]

  // ── Confirmado: ajustar stock diferencial ────────────────────────────────
  if (remito.estado === 'confirmado') {
    const delta = remito.tipo === 'entrada' ? 1 : -1
    const oldItems = Array.isArray(remito.remito_items) ? remito.remito_items : []

    type StockEntry = { articulo_id: number; variante_id: number | null; cantidad: number }
    const makeKey = (a: number, v: number | null) => `${a}:${v ?? 'null'}`

    const oldMap = new Map<string, StockEntry>()
    for (const oi of oldItems) {
      oldMap.set(makeKey(oi.articulo_id, oi.variante_id ?? null), {
        articulo_id: oi.articulo_id, variante_id: oi.variante_id ?? null, cantidad: oi.cantidad,
      })
    }
    const newMap = new Map<string, StockEntry>()
    for (const ni of newItems) {
      const vid = ni.variante_id ?? null
      newMap.set(makeKey(ni.articulo_id, vid), { articulo_id: ni.articulo_id, variante_id: vid, cantidad: ni.cantidad })
    }

    const articuloIds = new Set<number>()

    // Ítems modificados (cantidad distinta) o eliminados (no están en newMap)
    for (const [key, oi] of oldMap) {
      const ni = newMap.get(key)
      const cantDiff = (ni?.cantidad ?? 0) - oi.cantidad
      if (cantDiff === 0) continue
      const err = await adjustArticuloStock(oi.articulo_id, oi.variante_id, remito.sucursal_id, delta * cantDiff, supabase)
      if (err) return NextResponse.json({ error: `Error ajustando stock: ${err}` }, { status: 500 })
      articuloIds.add(oi.articulo_id)
    }
    // Ítems nuevos (no estaban en oldMap)
    for (const [key, ni] of newMap) {
      if (!oldMap.has(key)) {
        const err = await adjustArticuloStock(ni.articulo_id, ni.variante_id, remito.sucursal_id, delta * ni.cantidad, supabase)
        if (err) return NextResponse.json({ error: `Error ajustando stock: ${err}` }, { status: 500 })
        articuloIds.add(ni.articulo_id)
      }
    }

    for (const aid of articuloIds) await syncArticuloStock(aid, supabase)

    // ── Salida hacia Sucursal: propagar deltas al remito entrada vinculado ──
    if (remito.tipo === 'salida' && remito.contraparte_tipo === 'sucursal' && remito.contraparte_sucursal_id) {
      const destSucursalId = remito.contraparte_sucursal_id
      const { data: remitoEntrada } = await supabase
        .from('remitos')
        .select('id, estado')
        .eq('remito_origen_id', Number(id))
        .eq('tipo', 'entrada')
        .maybeSingle()

      if (remitoEntrada && remitoEntrada.estado === 'confirmado') {
        const articuloIdsDestino = new Set<number>()

        for (const [key, oi] of oldMap) {
          const ni = newMap.get(key)
          const cantDiff = (ni?.cantidad ?? 0) - oi.cantidad
          if (cantDiff === 0) continue
          // En destino el remito es entrada: delta = +cantDiff
          const err = await adjustArticuloStock(oi.articulo_id, oi.variante_id, destSucursalId, cantDiff, supabase)
          if (!err) articuloIdsDestino.add(oi.articulo_id)
        }
        for (const [key, ni] of newMap) {
          if (!oldMap.has(key)) {
            const err = await adjustArticuloStock(ni.articulo_id, ni.variante_id, destSucursalId, ni.cantidad, supabase)
            if (!err) articuloIdsDestino.add(ni.articulo_id)
          }
        }

        for (const aid of articuloIdsDestino) await syncArticuloStock(aid, supabase)

        // Reemplazar ítems del remito de entrada vinculado
        await supabase.from('remito_items').delete().eq('remito_id', remitoEntrada.id)
        if (newItems.length > 0) {
          await supabase.from('remito_items').insert(
            newItems.map(item => ({
              remito_id: remitoEntrada.id,
              articulo_id: item.articulo_id,
              variante_id: item.variante_id ?? null,
              cantidad: item.cantidad,
              costo_unitario: item.costo_unitario ?? null,
            }))
          )
        }
      }
    }
  }

  // Reemplazar ítems del remito principal (válido para borrador y confirmado)
  await supabase.from('remito_items').delete().eq('remito_id', id)
  if (newItems.length > 0) {
    await supabase.from('remito_items').insert(
      newItems.map(item => ({
        remito_id: Number(id),
        articulo_id: item.articulo_id,
        variante_id: item.variante_id ?? null,
        cantidad: item.cantidad,
        costo_unitario: item.costo_unitario ?? null,
      }))
    )
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'Administrador') {
    return NextResponse.json({ error: 'Solo un administrador puede eliminar remitos' }, { status: 403 })
  }
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data: remito, error: fetchError } = await supabase
    .from('remitos')
    .select('id, numero, sucursal_id, estado, tipo, created_at')
    .eq('id', id)
    .single()

  if (fetchError || !remito) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (!['borrador', 'anulado'].includes(remito.estado)) {
    return NextResponse.json({ error: 'Solo se pueden eliminar remitos en borrador o anulados' }, { status: 409 })
  }

  const { error } = await supabase.from('remitos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('eliminaciones_log').insert({
    tipo: 'remito',
    referencia_id: Number(id),
    numero: remito.numero,
    cliente_nombre: null,
    total: null,
    fecha_documento: remito.created_at ? (remito.created_at as string).slice(0, 10) : null,
    sucursal_id: remito.sucursal_id,
    estado_previo: remito.estado,
    usuario_id: session.user.id,
    datos_extra: { tipo_remito: remito.tipo },
  })

  return NextResponse.json({ ok: true })
}
