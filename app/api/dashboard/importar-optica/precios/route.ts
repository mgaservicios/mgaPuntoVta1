import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/services/supabase-tenant'
import { requirePermission } from '@/lib/require-permission'

const LISTA_VENTA_ID = 2
const PARALLEL = 10

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission('inventario.articulos.editar')
    if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    const supabase = await getTenantClient(session)

    const body = await req.json()
    const rows: { artCodigo: string; precio: number; fechaPrecio: string }[] = body?.rows ?? []
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: 'Sin filas recibidas' }, { status: 400 })

    const errors: { codigo: string; error: string }[] = []

    // Batch-lookup articulo_ids
    const codigos = [...new Set(rows.map(r => String(r.artCodigo ?? '').trim()).filter(Boolean))]
    if (codigos.length === 0)
      return NextResponse.json({ error: 'Ninguna fila tiene código de artículo' }, { status: 400 })

    // Batch lookup to stay under PostgREST URL length limits
    const codigoToId: Record<string, number> = {}
    const LOOKUP_BATCH = 500
    for (let i = 0; i < codigos.length; i += LOOKUP_BATCH) {
      const chunk = codigos.slice(i, i + LOOKUP_BATCH)
      const { data: articulosChunk, error: artErr } = await supabase
        .from('articulos')
        .select('id, codigo')
        .in('codigo', chunk)
      if (artErr) {
        const detail = artErr.message || artErr.details || artErr.hint || artErr.code || JSON.stringify(artErr)
        return NextResponse.json({ error: `Error buscando artículos: ${detail}` }, { status: 500 })
      }
      for (const a of articulosChunk ?? []) codigoToId[String(a.codigo)] = a.id
    }

    // Build precios rows
    const preciosRows: {
      articulo_id: number; variante_id: null; lista_precio_id: number
      precio: number; vigente_desde: string; origen_tipo: string; created_by: string | null
    }[] = []

    for (const r of rows) {
      const codigo = String(r.artCodigo ?? '').trim()
      if (!codigo) continue
      const articuloId = codigoToId[codigo]
      if (!articuloId) { errors.push({ codigo, error: 'Artículo no encontrado' }); continue }
      const precio = Number(r.precio)
      if (isNaN(precio) || precio <= 0) { errors.push({ codigo, error: `Precio inválido: ${r.precio}` }); continue }

      const vigente_desde = r.fechaPrecio && !isNaN(new Date(r.fechaPrecio).getTime())
        ? new Date(r.fechaPrecio).toISOString()
        : new Date().toISOString()

      preciosRows.push({
        articulo_id: articuloId,
        variante_id: null,
        lista_precio_id: LISTA_VENTA_ID,
        precio,
        vigente_desde,
        origen_tipo: 'manual',
        created_by: session.user.id ?? null,
      })
    }

    if (preciosRows.length === 0)
      return NextResponse.json({ ok: 0, errors })

    // Bulk insert precios in batches
    let okCount = 0
    const BATCH = 200
    for (let i = 0; i < preciosRows.length; i += BATCH) {
      const batch = preciosRows.slice(i, i + BATCH)
      const { error } = await supabase.from('precios').insert(batch)
      if (error) {
        for (const row of batch) {
          const { error: e } = await supabase.from('precios').insert([row])
          if (e) errors.push({ codigo: String(row.articulo_id), error: e.message })
          else okCount++
        }
      } else {
        okCount += batch.length
      }
    }

    // Bulk update articulos.precio_venta (last price per articulo wins)
    const lastPriceMap = new Map<number, number>()
    for (const r of preciosRows) lastPriceMap.set(r.articulo_id, r.precio)

    const entries = Array.from(lastPriceMap.entries())
    for (let i = 0; i < entries.length; i += PARALLEL) {
      await Promise.all(
        entries.slice(i, i + PARALLEL).map(([id, precio_venta]) =>
          supabase.from('articulos').update({ precio_venta }).eq('id', id)
        )
      )
    }

    return NextResponse.json({ ok: okCount, errors })
  } catch (e) {
    return NextResponse.json({ error: `Error inesperado: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
