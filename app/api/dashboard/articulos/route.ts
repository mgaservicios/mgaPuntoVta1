import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { requirePermission } from '@/lib/require-permission'
import { getActiveSucursalId } from '@/lib/sucursal'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)
  const activeSucursalId = await getActiveSucursalId()
  if (!activeSucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')
  const soloActivos = searchParams.get('activo') !== 'false'
  const conStock = searchParams.get('con_stock') === 'true'
  const filtroProveedorId = searchParams.get('proveedor_id')
  const filtroMarcaId = searchParams.get('marca_id')
  const filtroCategoriaId = searchParams.get('categoria_id')

  const VARIANTES_SELECT = 'id, sku, precio_venta, stock_actual, activo, articulo_id, variante_atributos(valor, atributo_tipos(nombre))'

  const SELECT_BASE = `id, codigo, nombre, tipo_articulo, precio_venta, stock_actual, activo, imagen_url,
    categorias(id, nombre), subcategorias(id, nombre), marcas(id, nombre), proveedores(id, nombre),
    articulo_variantes(${VARIANTES_SELECT})`

  // `con_stock` se resuelve con un embed !inner, no trayendo los ids a la app para
  // filtrar con `in ()`. Con ~5.000 artículos con stock la lista de ids pasaba los
  // 20 KB de URL y PostgREST respondía 400, así que la búsqueda no devolvía nada.
  const SELECT_CON_STOCK = `${SELECT_BASE}, articulo_stock!inner(sucursal_id, variante_id, stock_actual)`

  // El tipo del select se come el parser de postgrest-js, que no puede parsear un
  // ternario entre dos literales. El resultado se castea a EnrichedRow más abajo.
  const select: string = conStock ? SELECT_CON_STOCK : SELECT_BASE

  async function enrichVariantes(rows: { id: number; tipo_articulo: string }[]) {
    const ids = rows.filter(a => a.tipo_articulo === 'con_variantes').map(a => a.id)
    if (ids.length === 0) return rows.map(a => ({ ...a, articulo_variantes: [] }))
    const { data: variantes } = await supabase
      .from('articulo_variantes')
      .select(VARIANTES_SELECT)
      .in('articulo_id', ids)
    const map: Record<number, unknown[]> = {}
    for (const v of (variantes ?? []) as Array<{ articulo_id: number }>) {
      ;(map[v.articulo_id] ??= []).push(v)
    }
    return rows.map(a => ({ ...a, articulo_variantes: map[a.id] ?? [] }))
  }

  type StockEntry = {
    sucursal_id: number
    sucursal_nombre: string
    stock_actual: number
    is_active: boolean
  }

  async function enrichStock(rows: Array<{
    id: number
    tipo_articulo: string
    articulo_variantes?: Array<{ id: number }>
  }>) {
    const articuloIds = rows.map(a => a.id)
    if (articuloIds.length === 0) return rows

    // Fetch stock rows and all sucursales in parallel — avoids the array/scalar
    // ambiguity of the sucursales(nombre) FK join and ensures every sucursal
    // always appears as a column (even with 0 stock).
    const [{ data: stockRows }, { data: sucursalesData }] = await Promise.all([
      supabase
        .from('articulo_stock')
        .select('articulo_id, variante_id, sucursal_id, stock_actual')
        .in('articulo_id', articuloIds),
      supabase
        .from('sucursales')
        .select('id, nombre'),
    ])

    const allSucursales = (sucursalesData ?? []) as Array<{ id: number; nombre: string }>
    const sucNombreMap: Record<number, string> = Object.fromEntries(allSucursales.map(s => [s.id, s.nombre]))

    const byArticulo: Record<number, StockEntry[]> = {}
    const byVariante: Record<number, StockEntry[]> = {}

    for (const s of (stockRows ?? []) as Array<{
      articulo_id: number
      variante_id: number | null
      sucursal_id: number
      stock_actual: number
    }>) {
      const entry: StockEntry = {
        sucursal_id: s.sucursal_id,
        sucursal_nombre: sucNombreMap[s.sucursal_id] ?? '',
        stock_actual: s.stock_actual,
        is_active: s.sucursal_id === activeSucursalId,
      }
      if (s.variante_id === null) {
        ;(byArticulo[s.articulo_id] ??= []).push(entry)
      } else {
        ;(byVariante[s.variante_id] ??= []).push(entry)
      }
    }

    // Ensure ALL sucursales always have an entry (shows 0 when missing)
    function withAll(entries: StockEntry[]): StockEntry[] {
      const result = [...entries]
      for (const suc of allSucursales) {
        if (!result.some(e => e.sucursal_id === suc.id)) {
          result.push({ sucursal_id: suc.id, sucursal_nombre: suc.nombre, stock_actual: 0, is_active: suc.id === activeSucursalId })
        }
      }
      return result
    }

    const deSucursalActiva = (entries: StockEntry[]) =>
      entries.filter(e => e.sucursal_id === activeSucursalId)
        .reduce((n, e) => n + Number(e.stock_actual), 0)

    return rows.map(a => {
      const stockArticulo = withAll(byArticulo[a.id] ?? [])
      const articulo_variantes = (a.articulo_variantes ?? []).map((v) => {
        const stockVariante = withAll(byVariante[v.id] ?? [])
        return { ...v, stock_sucursales: stockVariante, stock_sucursal_actual: deSucursalActiva(stockVariante) }
      })

      return {
        ...a,
        // El embed !inner solo estaba para filtrar; el stock por sucursal sale
        // de acá, ya normalizado con 0 en las sucursales sin fila.
        articulo_stock: undefined,
        stock_sucursales: stockArticulo,
        // Un con_variantes no tiene fila de stock a nivel artículo: el stock vive
        // en las variantes. Sumar solo la fila de artículo daría 0 siempre.
        stock_sucursal_actual: a.tipo_articulo === 'con_variantes'
          ? articulo_variantes.reduce((n, v) => n + v.stock_sucursal_actual, 0)
          : deSucursalActiva(stockArticulo),
        articulo_variantes,
      }
    })
  }

  async function enrichPrecios(rows: Array<{ id: number; articulo_variantes?: Array<{ id: number }> }>) {
    if (rows.length === 0) return rows

    const articuloIds = rows.map(a => a.id)
    const endOfDay = new Date().toISOString().slice(0, 10) + 'T23:59:59'

    const [listasRes, preciosBaseRes, preciosVarianteRes] = await Promise.all([
      supabase.from('listas_precio').select('id, nombre, tipo, categoria, lista_base_id, porcentaje').eq('activo', true).order('id'),
      supabase.from('precios').select('articulo_id, lista_precio_id, precio, vigente_desde')
        .in('articulo_id', articuloIds).is('variante_id', null).lte('vigente_desde', endOfDay).order('vigente_desde', { ascending: false }),
      supabase.from('precios').select('variante_id, lista_precio_id, precio, vigente_desde')
        .in('articulo_id', articuloIds).not('variante_id', 'is', null).lte('vigente_desde', endOfDay).order('vigente_desde', { ascending: false }),
    ])

    const listas = listasRes.data ?? []
    type PE = { precio: number; vigente_desde: string }

    // último precio base por "articuloId-listaId"
    const ultimosBase = new Map<string, PE>()
    for (const p of (preciosBaseRes.data ?? []) as Array<{ articulo_id: number; lista_precio_id: number; precio: number; vigente_desde: string }>) {
      const key = `${p.articulo_id}-${p.lista_precio_id}`
      if (!ultimosBase.has(key)) ultimosBase.set(key, { precio: p.precio, vigente_desde: p.vigente_desde })
    }

    // último precio diferencial por "varianteId-listaId"
    const ultimosVariante = new Map<string, PE>()
    for (const p of (preciosVarianteRes.data ?? []) as Array<{ variante_id: number; lista_precio_id: number; precio: number; vigente_desde: string }>) {
      const key = `${p.variante_id}-${p.lista_precio_id}`
      if (!ultimosVariante.has(key)) ultimosVariante.set(key, { precio: p.precio, vigente_desde: p.vigente_desde })
    }

    function buildPrecios(articuloId: number, varianteId: number | null) {
      return listas.map(lista => {
        if (lista.tipo === 'manual') {
          const propio = varianteId ? ultimosVariante.get(`${varianteId}-${lista.id}`) : null
          const base   = ultimosBase.get(`${articuloId}-${lista.id}`)
          const fuente = propio ?? base
          const heredado = varianteId ? (!propio && !!base) : false
          return { lista_id: lista.id, lista_nombre: lista.nombre, tipo: lista.tipo, categoria: lista.categoria, precio: fuente?.precio ?? null, vigente_desde: fuente?.vigente_desde ?? null, heredado }
        } else {
          // Precio base de la lista calculada
          const bid = lista.lista_base_id
          const propioBase = (varianteId && bid) ? ultimosVariante.get(`${varianteId}-${bid}`) : null
          const baseA      = bid ? ultimosBase.get(`${articuloId}-${bid}`) : null
          const fuenteBase = propioBase ?? baseA
          const baseDate   = fuenteBase?.vigente_desde?.slice(0, 10) ?? ''

          // Override guardado directamente en esta lista calculada
          const overridePropio = varianteId ? ultimosVariante.get(`${varianteId}-${lista.id}`) : null
          const overrideBase   = ultimosBase.get(`${articuloId}-${lista.id}`)
          const overrideSrc    = overridePropio ?? overrideBase
          const overrideDate   = overrideSrc?.vigente_desde?.slice(0, 10) ?? ''

          // El override tiene prioridad SOLO si es más reciente que el precio base
          if (overrideSrc && overrideDate >= baseDate) {
            const heredado = varianteId ? (!overridePropio && !!overrideBase) : false
            return { lista_id: lista.id, lista_nombre: lista.nombre, tipo: lista.tipo, categoria: lista.categoria, precio: overrideSrc.precio, vigente_desde: overrideSrc.vigente_desde, heredado }
          }
          // Derivar dinámicamente del precio base
          const precio = fuenteBase && lista.porcentaje != null ? fuenteBase.precio * (1 + Number(lista.porcentaje) / 100) : null
          const heredado = varianteId ? (!propioBase && !!baseA) : false
          return { lista_id: lista.id, lista_nombre: lista.nombre, tipo: lista.tipo, categoria: lista.categoria, precio, vigente_desde: fuenteBase?.vigente_desde ?? null, heredado }
        }
      })
    }

    return rows.map(a => ({
      ...a,
      precios_vigentes: buildPrecios(a.id, null),
      articulo_variantes: (a.articulo_variantes ?? []).map(v => ({
        ...v,
        precios_vigentes: buildPrecios(a.id, v.id),
      })),
    }))
  }

  type EnrichedRow = { id: number; tipo_articulo: string; articulo_variantes?: Array<{ id: number }> } & Record<string, unknown>
  let enriched: EnrichedRow[]

  // `articulo_stock.sucursal_id` / `.stock_actual` solo existen en el select cuando
  // se pidió con_stock, así que los filtros de stock se agregan solo en ese caso.
  // PostgREST deduplica el artículo padre: una fila por artículo, con todas sus
  // filas de stock de la sucursal activa embebidas.
  if (q?.trim()) {
    const term = q.trim()
    // Exacto y parcial en una sola pasada: el exacto es un subconjunto del
    // parcial, así que la consulta anterior gastaba una vuelta de más.
    // Ojo: dentro del or() no se puede filtrar por una tabla embebida
    // (`articulo_variantes.sku` da PGRST100), por eso el SKU no se busca acá.
    let query = supabase
      .from('articulos')
      .select(select)
      .or(`codigo.ilike.${term},codigo_barras.ilike.${term},`
        + `codigo.ilike.%${term}%,nombre.ilike.%${term}%`)
      .order('nombre')
      .limit(50)

    if (soloActivos) query = query.eq('activo', true)
    if (conStock) query = query.eq('articulo_stock.sucursal_id', activeSucursalId).gt('articulo_stock.stock_actual', 0)
    if (filtroProveedorId) query = query.eq('proveedor_id', filtroProveedorId)
    if (filtroMarcaId)     query = query.eq('marca_id', filtroMarcaId)
    if (filtroCategoriaId) query = query.eq('categoria_id', filtroCategoriaId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    enriched = (data ?? []) as unknown as EnrichedRow[]
  } else {
    let query = supabase
      .from('articulos')
      .select(select)
      .order('nombre')

    if (soloActivos) query = query.eq('activo', true)
    if (conStock) query = query.eq('articulo_stock.sucursal_id', activeSucursalId).gt('articulo_stock.stock_actual', 0)
    if (filtroProveedorId) query = query.eq('proveedor_id', filtroProveedorId)
    if (filtroMarcaId)     query = query.eq('marca_id', filtroMarcaId)
    if (filtroCategoriaId) query = query.eq('categoria_id', filtroCategoriaId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    enriched = (data ?? []) as unknown as EnrichedRow[]
  }

  // enrichStock y enrichPrecios son independientes — ambos leen de `enriched` sin depender el uno del otro
  const [withStock, withPrecios] = await Promise.all([
    enrichStock(enriched),
    enrichPrecios(enriched),
  ])

  const preciosById = new Map(withPrecios.map((a) => [a.id, a as Record<string, unknown>]))

  return NextResponse.json(
    withStock.map((a) => {
      const ap = preciosById.get(a.id) as undefined | (typeof a & {
        precios_vigentes: unknown
        articulo_variantes?: Array<{ id: number; precios_vigentes: unknown }>
      })
      return {
        ...a,
        precios_vigentes: ap?.precios_vigentes,
        articulo_variantes: (a.articulo_variantes ?? []).map((v, vi) => ({
          ...v,
          precios_vigentes: ap?.articulo_variantes?.[vi]?.precios_vigentes,
        })),
      }
    })
  )
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('inventario.articulos.crear')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const body = await req.json()
  const {
    nombre, codigo, descripcion, tipo_articulo = 'simple',
    categoria_id, subcategoria_id, marca_id, proveedor_id,
    precio_venta, precio_compra,
    stock_actual = 0, stock_minimo = 0,
    unidad_id, codigo_barras, imagen_url,
  } = body

  if (!nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('articulos')
    .insert({
      nombre: nombre.trim(),
      codigo: codigo?.trim() || null,
      descripcion: descripcion?.trim() || null,
      tipo_articulo,
      categoria_id: categoria_id || null,
      subcategoria_id: subcategoria_id || null,
      marca_id: marca_id || null,
      proveedor_id: proveedor_id || null,
      precio_venta: precio_venta ?? null,
      precio_compra: precio_compra ?? null,
      stock_actual,
      stock_minimo,
      unidad_id: unidad_id || null,
      codigo_barras: codigo_barras?.trim() || null,
      imagen_url: imagen_url?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
