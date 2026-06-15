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

    return rows.map(a => ({
      ...a,
      stock_sucursales: withAll(byArticulo[a.id] ?? []),
      articulo_variantes: (a.articulo_variantes ?? []).map((v) => ({
        ...v,
        stock_sucursales: withAll(byVariante[v.id] ?? []),
      })),
    }))
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

  if (q?.trim()) {
    const term = q.trim()
    const SELECT_Q = `id, codigo, nombre, tipo_articulo, precio_venta, stock_actual, activo, imagen_url,
      categorias(id, nombre), subcategorias(id, nombre), marcas(id, nombre), proveedores(id, nombre),
      articulo_variantes(${VARIANTES_SELECT})`

    // 1. Exacto en codigo o codigo_barras
    let byCodeQ = supabase
      .from('articulos')
      .select(SELECT_Q)
      .or(`codigo.ilike.${term},codigo_barras.ilike.${term}`)
      .order('nombre')
      .limit(50)
    if (soloActivos) byCodeQ = byCodeQ.eq('activo', true)
    if (filtroProveedorId) byCodeQ = byCodeQ.eq('proveedor_id', filtroProveedorId)
    if (filtroMarcaId)     byCodeQ = byCodeQ.eq('marca_id', filtroMarcaId)
    if (filtroCategoriaId) byCodeQ = byCodeQ.eq('categoria_id', filtroCategoriaId)

    const { data: byCode, error: errCode } = await byCodeQ
    if (errCode) return NextResponse.json({ error: errCode.message }, { status: 500 })

    if ((byCode ?? []).length > 0) {
      enriched = (byCode ?? []) as EnrichedRow[]
    } else {
      // 2. Parcial en codigo o nombre
      let byPartialQ = supabase
        .from('articulos')
        .select(SELECT_Q)
        .or(`codigo.ilike.%${term}%,nombre.ilike.%${term}%`)
        .order('nombre')
        .limit(50)
      if (soloActivos) byPartialQ = byPartialQ.eq('activo', true)
      if (filtroProveedorId) byPartialQ = byPartialQ.eq('proveedor_id', filtroProveedorId)
      if (filtroMarcaId)     byPartialQ = byPartialQ.eq('marca_id', filtroMarcaId)
      if (filtroCategoriaId) byPartialQ = byPartialQ.eq('categoria_id', filtroCategoriaId)

      const { data: byPartial, error: errPartial } = await byPartialQ
      if (errPartial) return NextResponse.json({ error: errPartial.message }, { status: 500 })
      enriched = (byPartial ?? []) as EnrichedRow[]
    }
  } else {
    let query = supabase
      .from('articulos')
      .select(`id, codigo, nombre, tipo_articulo, precio_venta, stock_actual, activo,
        categorias(id, nombre), subcategorias(id, nombre), marcas(id, nombre), proveedores(id, nombre),
        articulo_variantes(${VARIANTES_SELECT})`)
      .order('nombre')

    if (soloActivos) query = query.eq('activo', true)
    if (filtroProveedorId) query = query.eq('proveedor_id', filtroProveedorId)
    if (filtroMarcaId)     query = query.eq('marca_id', filtroMarcaId)
    if (filtroCategoriaId) query = query.eq('categoria_id', filtroCategoriaId)

    if (conStock) {
      const { data: stockIds } = await supabase
        .from('articulo_stock')
        .select('articulo_id')
        .eq('sucursal_id', activeSucursalId)
        .gt('stock_actual', 0)
      const artIds = [...new Set((stockIds ?? []).map((s: { articulo_id: number }) => s.articulo_id))]
      if (artIds.length === 0) return NextResponse.json([])
      query = query.in('id', artIds)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    enriched = (data ?? []) as EnrichedRow[]
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
