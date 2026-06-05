import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { adjustArticuloStock, syncArticuloStock } from '@/services/stock'
import type { SupabaseClient } from '@supabase/supabase-js'

type RemitoItem = { articulo_id: number; variante_id: number | null; cantidad: number; remito_id: number }
type VentaItem  = { articulo_id: number; variante_id: number | null; cantidad: number; venta_id: number }

async function fetchByIds<T>(
  supabase: SupabaseClient,
  table: string,
  idColumn: string,
  columns: string,
  ids: number[],
): Promise<T[]> {
  if (ids.length === 0) return []
  const batchSize = 200
  const result: T[] = []
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const { data } = await supabase
      .from(table)
      .select(columns)
      .in(idColumn, batch)
    if (data) result.push(...(data as T[]))
  }
  return result
}

function rowKey(aid: number, vid: number | null, sid: number) {
  return `${aid}|${vid ?? ''}|${sid}`
}

// GET — calcular discrepancias de stock
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { searchParams } = new URL(req.url)
  const sucursalId = searchParams.get('sucursal_id') ? parseInt(searchParams.get('sucursal_id')!) : null
  const debug = searchParams.get('debug') === '1'

  // ── 1. Stock actual desde articulo_stock ──────────────────────────────────
  let asQ = supabase
    .from('articulo_stock')
    .select('articulo_id, variante_id, sucursal_id, stock_actual')
  if (sucursalId) asQ = asQ.eq('sucursal_id', sucursalId)
  const { data: stockActual } = await asQ

  // ── 2. Remitos confirmados ─────────────────────────────────────────────────
  let remitosQ = supabase
    .from('remitos')
    .select('id, tipo, sucursal_id')
    .eq('estado', 'confirmado')
  if (sucursalId) remitosQ = remitosQ.eq('sucursal_id', sucursalId)
  const { data: remitos } = await remitosQ

  const remitoIds   = (remitos ?? []).map(r => r.id)
  const remitosById = Object.fromEntries((remitos ?? []).map(r => [r.id, r]))
  const remitoItems = await fetchByIds<RemitoItem>(supabase, 'remito_items', 'remito_id', 'articulo_id,variante_id,cantidad,remito_id', remitoIds)

  // ── 3. Ventas completadas — solo las de esta sucursal ────────────────────
  let ventasQ = supabase
    .from('ventas')
    .select('id, sucursal_id')
    .eq('estado', 'completada')
  if (sucursalId) ventasQ = ventasQ.eq('sucursal_id', sucursalId)
  const { data: ventas } = await ventasQ

  const ventaIds   = (ventas ?? []).map(v => v.id)
  const ventasById = Object.fromEntries((ventas ?? []).map(v => [v.id, v]))
  const ventaItems = await fetchByIds<VentaItem>(supabase, 'venta_items', 'venta_id', 'articulo_id,variante_id,cantidad,venta_id', ventaIds)

  // ── 5. Acumular stock esperado ─────────────────────────────────────────────
  // Nota: órdenes de venta NO se cuentan aquí. El stock se descuenta cuando
  // la venta se registra (POS o remito de salida). Contar también las órdenes
  // confirmadas causa doble descuento cuando la venta correspondiente existe.
  // Índice: (articulo_id, variante_id) → sucursales que tienen ese artículo en articulo_stock
  // Permite atribuir ventas/órdenes históricas sin sucursal_id a la sucursal correcta.
  const stockPorArticulo = new Map<string, number[]>()
  for (const s of (stockActual ?? [])) {
    const k = `${s.articulo_id}|${s.variante_id ?? ''}`
    const entry = stockPorArticulo.get(k)
    if (entry) { entry.push(s.sucursal_id) }
    else { stockPorArticulo.set(k, [s.sucursal_id]) }
  }

  function resolveSucursal(aid: number, vid: number | null, sid: number | null): number | null {
    if (sid !== null) return sid
    // Sin sucursal_id: buscar en articulo_stock; si hay exactamente una sucursal, atribuir ahí
    const sids = stockPorArticulo.get(`${aid}|${vid ?? ''}`) ?? []
    return sids.length === 1 ? sids[0] : null
  }

  type Calc = { articulo_id: number; variante_id: number | null; sucursal_id: number; qty: number }
  const expectedMap = new Map<string, Calc>()

  function addQty(aid: number, vid: number | null, sid: number, delta: number) {
    const k = rowKey(aid, vid, sid)
    const e = expectedMap.get(k)
    if (e) { e.qty += delta }
    else { expectedMap.set(k, { articulo_id: aid, variante_id: vid, sucursal_id: sid, qty: delta }) }
  }

  for (const item of remitoItems) {
    const r = remitosById[item.remito_id]
    if (!r) continue
    addQty(item.articulo_id, item.variante_id ?? null, r.sucursal_id,
      r.tipo === 'entrada' ? item.cantidad : -item.cantidad)
  }
  for (const item of ventaItems) {
    const v = ventasById[item.venta_id]
    if (!v) continue
    const sid = resolveSucursal(item.articulo_id, item.variante_id ?? null, v.sucursal_id)
    if (sid === null) continue  // múltiples sucursales posibles → no se puede atribuir
    addQty(item.articulo_id, item.variante_id ?? null, sid, -item.cantidad)
  }
  if (debug) {
    return NextResponse.json({
      sucursalId,
      remitos: remitos ?? [],
      remitoItems,
      ventas: ventas ?? [],
      ventaItems,
      expectedMap: Object.fromEntries(expectedMap),
      stockActual: stockActual ?? [],
    })
  }

  // ── 6. Comparar con stock actual ───────────────────────────────────────────
  const actualMap = new Map<string, number>()
  for (const s of (stockActual ?? [])) {
    actualMap.set(rowKey(s.articulo_id, s.variante_id, s.sucursal_id), Number(s.stock_actual))
  }

  type Discrepancia = {
    articulo_id: number; variante_id: number | null; sucursal_id: number
    stock_actual: number; stock_calculado: number; diferencia: number
  }
  const discrepancias: Discrepancia[] = []

  for (const [k, calc] of expectedMap) {
    const stockCalc = Math.round(calc.qty * 1000) / 1000
    const stockAct  = actualMap.get(k) ?? 0
    if (Math.abs(stockCalc - stockAct) > 0.001) {
      discrepancias.push({
        articulo_id: calc.articulo_id, variante_id: calc.variante_id, sucursal_id: calc.sucursal_id,
        stock_actual: stockAct, stock_calculado: stockCalc, diferencia: stockCalc - stockAct,
      })
    }
  }

  // Items en articulo_stock con stock pero sin movimientos registrados
  for (const [k, stockAct] of actualMap) {
    if (!expectedMap.has(k) && Math.abs(stockAct) > 0.001) {
      const parts = k.split('|')
      discrepancias.push({
        articulo_id: parseInt(parts[0]),
        variante_id: parts[1] ? parseInt(parts[1]) : null,
        sucursal_id: parseInt(parts[2]),
        stock_actual: stockAct, stock_calculado: 0, diferencia: -stockAct,
      })
    }
  }

  if (discrepancias.length === 0) return NextResponse.json([])

  // ── 7. Enriquecer con nombres ──────────────────────────────────────────────
  const articuloIds = [...new Set(discrepancias.map(d => d.articulo_id))]
  const varianteIds = [...new Set(discrepancias.map(d => d.variante_id).filter((v): v is number => v !== null))]
  const sucursalIds = [...new Set(discrepancias.map(d => d.sucursal_id))]

  const [articulosRes, sucursalesRes] = await Promise.all([
    supabase.from('articulos').select('id, nombre').in('id', articuloIds),
    supabase.from('sucursales').select('id, nombre').in('id', sucursalIds),
  ])

  let variantesMap: Record<number, string> = {}
  if (varianteIds.length > 0) {
    const { data: variantes } = await supabase
      .from('articulo_variantes')
      .select('id, variante_atributos(valor, atributo_tipos(nombre))')
      .in('id', varianteIds)
    if (variantes) {
      for (const v of variantes) {
        const attrs = (v.variante_atributos ?? []) as unknown as { valor: string; atributo_tipos?: { nombre: string } | null }[]
        variantesMap[v.id] = attrs.map(a => `${a.atributo_tipos?.nombre ?? ''}: ${a.valor}`).join(' / ') || `Variante #${v.id}`
      }
    }
  }

  const articulosMap  = Object.fromEntries((articulosRes.data ?? []).map(a => [a.id, a.nombre]))
  const sucursalesMap = Object.fromEntries((sucursalesRes.data ?? []).map(s => [s.id, s.nombre]))

  const result = discrepancias
    .map(d => ({
      ...d,
      nombre_articulo: articulosMap[d.articulo_id] ?? `Artículo #${d.articulo_id}`,
      descripcion_variante: d.variante_id ? (variantesMap[d.variante_id] ?? null) : null,
      nombre_sucursal: sucursalesMap[d.sucursal_id] ?? `Sucursal #${d.sucursal_id}`,
    }))
    .sort((a, b) => a.nombre_articulo.localeCompare(b.nombre_articulo) || (a.descripcion_variante ?? '').localeCompare(b.descripcion_variante ?? ''))

  return NextResponse.json(result)
}

// POST — aplicar ajustes creando remitos de entrada/salida confirmados
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const body = await req.json()
  const ajustes: { articulo_id: number; variante_id: number | null; sucursal_id: number; stock_nuevo: number }[] = body.ajustes ?? []

  if (ajustes.length === 0) return NextResponse.json({ error: 'Sin ajustes' }, { status: 400 })

  // 1. Leer stock actual y calcular delta para cada ítem
  type AjusteConDelta = {
    articulo_id: number; variante_id: number | null; sucursal_id: number
    stock_nuevo: number; stock_actual: number; delta: number
  }
  const conDelta: AjusteConDelta[] = []

  for (const aj of ajustes) {
    const variante_id = aj.variante_id ?? null
    let q = supabase
      .from('articulo_stock')
      .select('stock_actual')
      .eq('articulo_id', aj.articulo_id)
      .eq('sucursal_id', aj.sucursal_id)
    q = variante_id === null ? q.is('variante_id', null) : q.eq('variante_id', variante_id)
    const { data } = await q.maybeSingle()
    const stock_actual = Number((data as { stock_actual?: number } | null)?.stock_actual ?? 0)
    const delta = Number(aj.stock_nuevo) - stock_actual
    if (Math.abs(delta) > 0.001) {
      conDelta.push({ articulo_id: aj.articulo_id, variante_id, sucursal_id: aj.sucursal_id, stock_nuevo: Number(aj.stock_nuevo), stock_actual, delta })
    }
  }

  if (conDelta.length === 0) return NextResponse.json({ ok: true, count: 0, remitos: [] })

  // 2. Agrupar por sucursal_id + tipo (entrada si delta>0, salida si delta<0)
  type Grupo = { sucursal_id: number; tipo: 'entrada' | 'salida'; items: AjusteConDelta[] }
  const gruposMap = new Map<string, Grupo>()
  for (const item of conDelta) {
    const tipo: 'entrada' | 'salida' = item.delta > 0 ? 'entrada' : 'salida'
    const key = `${item.sucursal_id}|${tipo}`
    const g = gruposMap.get(key)
    if (g) g.items.push(item)
    else gruposMap.set(key, { sucursal_id: item.sucursal_id, tipo, items: [item] })
  }

  const remitosCreados: string[] = []
  const articuloIdsSet = new Set<number>()

  // 3. Por cada grupo: crear remito + confirmar
  for (const grupo of gruposMap.values()) {
    const prefix = grupo.tipo === 'entrada' ? 'E' : 'S'
    const { count } = await supabase.from('remitos').select('id', { count: 'exact', head: true })
    const numero = `${prefix}-${String((count ?? 0) + 1).padStart(5, '0')}`

    const { data: remito, error: errRemito } = await supabase
      .from('remitos')
      .insert({
        numero,
        tipo: grupo.tipo,
        sucursal_id: grupo.sucursal_id,
        contraparte_tipo: 'persona',
        contraparte_nombre: 'AJUSTE DE STOCK',
        fecha: new Date().toISOString(),
        observaciones: 'AJUSTE DE STOCK POR DIFERENCIAS',
        estado: 'borrador',
        created_by: session.user.id,
      })
      .select()
      .single()

    if (errRemito || !remito) {
      console.error('[ajustes POST] error creando remito:', errRemito)
      return NextResponse.json({ error: `Error creando remito: ${errRemito?.message}` }, { status: 500 })
    }

    const itemsPayload = grupo.items.map(item => ({
      remito_id: remito.id,
      articulo_id: item.articulo_id,
      variante_id: item.variante_id,
      cantidad: Math.abs(item.delta),
      costo_unitario: null,
    }))
    await supabase.from('remito_items').insert(itemsPayload)

    // Confirmar: ajustar stock y sync
    const deltaDir = grupo.tipo === 'entrada' ? 1 : -1
    for (const item of grupo.items) {
      const err = await adjustArticuloStock(item.articulo_id, item.variante_id, grupo.sucursal_id, deltaDir * Math.abs(item.delta), supabase)
      if (err) console.error('[ajustes POST] stock error:', err)
      else articuloIdsSet.add(item.articulo_id)
    }

    await supabase
      .from('remitos')
      .update({ estado: 'confirmado', updated_at: new Date().toISOString() })
      .eq('id', remito.id)

    remitosCreados.push(numero)
  }

  for (const aid of articuloIdsSet) await syncArticuloStock(aid, supabase)

  return NextResponse.json({ ok: true, count: conDelta.length, remitos: remitosCreados })
}
