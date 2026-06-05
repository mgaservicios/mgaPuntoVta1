import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getSucursalFilter } from '@/lib/sucursal'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)
  const { sucursalId: activeSucursalId, verTodas } = await getSucursalFilter()
  if (!activeSucursalId && !verTodas) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const articuloId = searchParams.get('articulo_id')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  // ── Sin articulo_id: lista de artículos con stock de la sucursal activa ──
  if (!articuloId) {
    const q = searchParams.get('q')

    let articles: Array<{ id: number; tipo_articulo: string; articulo_variantes?: unknown[] }>

    if (q?.trim()) {
      const { data, error } = await supabase.rpc('buscar_articulos', {
        p_query: q.trim(),
        p_limit: 100,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const ids = (data ?? [])
        .filter((a: { tipo_articulo: string }) => a.tipo_articulo === 'con_variantes')
        .map((a: { id: number }) => a.id)
      let variantes: Array<{ articulo_id: number }> = []
      if (ids.length > 0) {
        const { data: vdata } = await supabase
          .from('articulo_variantes')
          .select('id, articulo_id, sku, stock_actual, activo, variante_atributos(valor, atributo_tipos(nombre))')
          .in('articulo_id', ids)
        variantes = (vdata ?? []) as Array<{ articulo_id: number }>
      }
      const map: Record<number, unknown[]> = {}
      for (const v of variantes) (map[v.articulo_id] ??= []).push(v)
      articles = (data ?? []).map((a: { id: number }) => ({ ...a, articulo_variantes: map[a.id] ?? [] }))
    } else {
      const { data, error } = await supabase
        .from('articulos')
        .select(`
          id, codigo, nombre, tipo_articulo, stock_actual, precio_venta, activo,
          categorias(id, nombre),
          articulo_variantes(id, sku, stock_actual, activo, variante_atributos(valor, atributo_tipos(nombre)))
        `)
        .eq('activo', true)
        .order('nombre')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      articles = (data ?? []) as typeof articles
    }

    // Override precio_venta: usar lista 2 (Venta Público).
    // Si lista 2 es calculada, derivar del precio más actual de lista 1 (Compra).
    if (articles.length > 0) {
      const articuloIds = articles.map(a => a.id)

      const [lista2Res, preciosRes] = await Promise.all([
        supabase.from('listas_precio').select('tipo, porcentaje').eq('id', 2).single(),
        supabase.from('precios')
          .select('articulo_id, lista_precio_id, precio')
          .in('articulo_id', articuloIds)
          .in('lista_precio_id', [1, 2])
          .is('variante_id', null)
          .order('vigente_desde', { ascending: false }),
      ])

      const lista2Tipo = lista2Res.data?.tipo ?? 'calculada'
      const lista2Pct  = Number(lista2Res.data?.porcentaje ?? 0)

      type PR = { articulo_id: number; lista_precio_id: number; precio: number }
      const latestL1: Record<number, number> = {}
      const latestL2: Record<number, number> = {}
      const seen1 = new Set<number>(), seen2 = new Set<number>()

      for (const p of (preciosRes.data ?? []) as PR[]) {
        if (p.lista_precio_id === 1 && !seen1.has(p.articulo_id)) {
          latestL1[p.articulo_id] = p.precio; seen1.add(p.articulo_id)
        }
        if (p.lista_precio_id === 2 && !seen2.has(p.articulo_id)) {
          latestL2[p.articulo_id] = p.precio; seen2.add(p.articulo_id)
        }
      }

      articles = articles.map(a => {
        let pv: number | null = null
        if (latestL2[a.id] != null) {
          pv = latestL2[a.id]
        } else if (lista2Tipo === 'calculada' && lista2Pct > 0 && latestL1[a.id] != null) {
          pv = latestL1[a.id] * (1 + lista2Pct / 100)
        }
        return {
          ...a,
          precio_venta: pv ?? (a as { precio_venta?: number | null }).precio_venta ?? null,
        }
      })
    }

    // Override stock_actual with per-sucursal values from articulo_stock
    if (articles.length > 0) {
      const articuloIds = articles.map(a => a.id)

      let stockQ = supabase
        .from('articulo_stock')
        .select('articulo_id, variante_id, stock_actual')
        .in('articulo_id', articuloIds)
      if (!verTodas && activeSucursalId) stockQ = stockQ.eq('sucursal_id', activeSucursalId)
      const { data: stockRows } = await stockQ

      type StockRow = { articulo_id: number; variante_id: number | null; stock_actual: number }
      const bySimple: Record<number, number> = {}
      const byVariante: Record<number, number> = {}
      const byConVariantes: Record<number, number> = {}

      for (const s of (stockRows ?? []) as StockRow[]) {
        if (s.variante_id === null) {
          bySimple[s.articulo_id] = s.stock_actual
        } else {
          byVariante[s.variante_id] = s.stock_actual
          byConVariantes[s.articulo_id] = (byConVariantes[s.articulo_id] ?? 0) + s.stock_actual
        }
      }

      articles = articles.map(a => ({
        ...a,
        stock_actual: a.tipo_articulo === 'con_variantes'
          ? (byConVariantes[a.id] ?? 0)
          : (bySimple[a.id] ?? 0),
        articulo_variantes: (a.articulo_variantes ?? []).map((v) => {
          const vt = v as { id: number }
          return { ...(v as object), stock_actual: byVariante[vt.id] ?? 0 }
        }),
      }))
    }

    return NextResponse.json(articles)
  }

  // ── Con articulo_id: movimientos filtrados por sucursal activa ──
  const id = parseInt(articuloId, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'articulo_id inválido' }, { status: 400 })
  const debug = searchParams.get('debug') === '1'

  // ── 1. movimientos_stock — filtrado por sucursal activa ──
  const movsQuery = (() => {
    let q = supabase
      .from('movimientos_stock')
      .select(`
        id, tipo, cantidad, stock_antes, stock_despues,
        referencia, observaciones, created_at, variante_id,
        sucursales(nombre),
        ventas(numero),
        articulo_variantes(sku, variante_atributos(valor, atributo_tipos(nombre)))
      `)
      .eq('articulo_id', id)
      .order('created_at', { ascending: false })
      .limit(500)
    if (!verTodas && activeSucursalId) q = q.eq('sucursal_id', activeSucursalId)
    if (desde) q = q.gte('created_at', desde)
    if (hasta) q = q.lte('created_at', hasta + 'T23:59:59')
    return q
  })()

  // ── 2. remito_items para este artículo ──
  const remitoItemsQuery = supabase
    .from('remito_items')
    .select('id, remito_id, variante_id, cantidad, articulo_variantes(sku, variante_atributos(valor, atributo_tipos(nombre)))')
    .eq('articulo_id', id)

  const [movsResult, remitoItemsResult] = await Promise.all([movsQuery, remitoItemsQuery])

  if (remitoItemsResult.error) {
    console.error('[seguimiento] remito_items error:', remitoItemsResult.error)
  }

  type RemitoItemRaw = {
    id: number; remito_id: number; variante_id: number | null; cantidad: number
    articulo_variantes: { sku: string | null; variante_atributos?: { valor: string; atributo_tipos: { nombre: string } | null }[] }[] | null
  }
  const remitoItems = (remitoItemsResult.data ?? []) as RemitoItemRaw[]
  const remitoIds = [...new Set(remitoItems.map(i => i.remito_id))]

  // ── 3. Remitos — filtrado por sucursal activa ──
  type RemitoRaw = {
    id: number; numero: string; tipo: string; fecha: string; estado: string; sucursal_id: number
  }
  let remitosData: RemitoRaw[] = []

  if (remitoIds.length > 0) {
    let rq = supabase
      .from('remitos')
      .select('id, numero, tipo, fecha, estado, sucursal_id')
      .in('id', remitoIds)
      .eq('estado', 'confirmado')
    if (!verTodas && activeSucursalId) rq = rq.eq('sucursal_id', activeSucursalId)
    if (desde) rq = rq.gte('fecha', desde)
    if (hasta) rq = rq.lte('fecha', hasta + 'T23:59:59')
    const { data, error } = await rq
    if (error) console.error('[seguimiento] remitos error:', error)
    remitosData = (data ?? []) as RemitoRaw[]
  }

  // ── 4. Nombres de sucursales ──
  const sucursalIds = [...new Set(remitosData.map(r => r.sucursal_id).filter(Boolean))]
  const sucursalesMap: Record<number, string> = {}
  if (sucursalIds.length > 0) {
    const { data: sucs } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .in('id', sucursalIds)
    for (const s of sucs ?? []) sucursalesMap[s.id] = s.nombre
  }

  const remitosMap = Object.fromEntries(remitosData.map(r => [r.id, r]))

  // ── Normalizar movimientos_stock ──
  type MovRaw = {
    id: number; tipo: string; cantidad: number; stock_antes: number; stock_despues: number
    referencia: string | null; observaciones: string | null; created_at: string; variante_id: number | null
    sucursales: { nombre: string } | null
    ventas: { numero: string } | null
    articulo_variantes: { sku: string | null; variante_atributos?: { valor: string; atributo_tipos: { nombre: string } | null }[] }[] | null
  }
  const movimientos = ((movsResult.data ?? []) as unknown as MovRaw[]).map(m => ({
    id: `mov-${m.id}`,
    tipo: m.tipo,
    cantidad: m.cantidad,
    stock_antes: m.stock_antes,
    stock_despues: m.stock_despues,
    referencia: m.ventas?.numero ?? m.referencia,
    observaciones: m.observaciones,
    fecha: m.created_at,
    variante_id: m.variante_id,
    sucursal: (() => { const s = m.sucursales as unknown; return (Array.isArray(s) ? (s as {nombre:string}[])[0]?.nombre : (s as {nombre:string}|null)?.nombre) ?? null })(),
    variante: m.articulo_variantes?.[0] ?? null,
  }))

  // ── Normalizar remito_items ──
  const remitoMovimientos = remitoItems
    .filter(item => !!remitosMap[item.remito_id])
    .map(item => {
      const r = remitosMap[item.remito_id]
      return {
        id: `rem-${item.id}`,
        tipo: r.tipo,
        cantidad: item.cantidad,
        stock_antes: null,
        stock_despues: null,
        referencia: r.numero,
        observaciones: null,
        fecha: r.fecha,
        variante_id: item.variante_id,
        sucursal: sucursalesMap[r.sucursal_id] ?? null,
        variante: item.articulo_variantes?.[0] ?? null,
      }
    })

  const combined = [...movimientos, ...remitoMovimientos].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  )

  if (debug) {
    return NextResponse.json({
      _debug: true,
      articulo_id: id,
      active_sucursal_id: activeSucursalId,
      remitoItems_count: remitoItems.length,
      remitoItems_error: remitoItemsResult.error,
      remitoIds,
      remitosData,
      remitosData_count: remitosData.length,
      movimientos_count: movimientos.length,
      remitoMovimientos_count: remitoMovimientos.length,
      combined_count: combined.length,
    })
  }

  return NextResponse.json(combined)
}
