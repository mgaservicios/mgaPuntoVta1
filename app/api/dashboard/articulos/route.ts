import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
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

    const { data: stockRows } = await supabase
      .from('articulo_stock')
      .select('articulo_id, variante_id, sucursal_id, stock_actual, sucursales(nombre)')
      .in('articulo_id', articuloIds)

    // Fetch the active sucursal name so we can always show its column even when stock is 0
    const { data: sucData } = await supabase
      .from('sucursales')
      .select('nombre')
      .eq('id', activeSucursalId)
      .maybeSingle()
    const activeSucursalNombre = (sucData as { nombre: string } | null)?.nombre ?? null

    const byArticulo: Record<number, StockEntry[]> = {}
    const byVariante: Record<number, StockEntry[]> = {}

    for (const s of (stockRows ?? []) as Array<{
      articulo_id: number
      variante_id: number | null
      sucursal_id: number
      stock_actual: number
      sucursales: { nombre: string }[] | null
    }>) {
      const entry: StockEntry = {
        sucursal_id: s.sucursal_id,
        sucursal_nombre: s.sucursales?.[0]?.nombre ?? '',
        stock_actual: s.stock_actual,
        is_active: s.sucursal_id === activeSucursalId,
      }
      if (s.variante_id === null) {
        ;(byArticulo[s.articulo_id] ??= []).push(entry)
      } else {
        ;(byVariante[s.variante_id] ??= []).push(entry)
      }
    }

    // Ensure the active sucursal always has an entry (shows 0 when missing)
    function withActive(entries: StockEntry[]): StockEntry[] {
      if (!activeSucursalNombre) return entries
      if (entries.some(e => e.sucursal_id === activeSucursalId)) return entries
      return [
        { sucursal_id: activeSucursalId as number, sucursal_nombre: activeSucursalNombre, stock_actual: 0, is_active: true },
        ...entries,
      ]
    }

    return rows.map(a => ({
      ...a,
      stock_sucursales: withActive(byArticulo[a.id] ?? []),
      articulo_variantes: (a.articulo_variantes ?? []).map((v) => ({
        ...v,
        stock_sucursales: withActive(byVariante[v.id] ?? []),
      })),
    }))
  }

  async function enrichPrecios(rows: Array<{ id: number; articulo_variantes?: Array<{ id: number }> }>) {
    if (rows.length === 0) return rows

    const articuloIds = rows.map(a => a.id)

    const [listasRes, preciosBaseRes, preciosVarianteRes] = await Promise.all([
      supabase.from('listas_precio').select('id, nombre, tipo, categoria, lista_base_id, porcentaje').eq('activo', true).order('id'),
      supabase.from('precios').select('articulo_id, lista_precio_id, precio, vigente_desde')
        .in('articulo_id', articuloIds).is('variante_id', null).order('vigente_desde', { ascending: false }),
      supabase.from('precios').select('variante_id, lista_precio_id, precio, vigente_desde')
        .in('articulo_id', articuloIds).not('variante_id', 'is', null).order('vigente_desde', { ascending: false }),
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
          // Si hay precio guardado directamente en esta lista calculada, tiene prioridad (override manual)
          const overridePropio = varianteId ? ultimosVariante.get(`${varianteId}-${lista.id}`) : null
          const overrideBase   = ultimosBase.get(`${articuloId}-${lista.id}`)
          if (overridePropio ?? overrideBase) {
            const src = overridePropio ?? overrideBase!
            const heredado = varianteId ? (!overridePropio && !!overrideBase) : false
            return { lista_id: lista.id, lista_nombre: lista.nombre, tipo: lista.tipo, categoria: lista.categoria, precio: src.precio, vigente_desde: src.vigente_desde, heredado }
          }
          // Derivar del precio de la lista base
          const bid = lista.lista_base_id
          const propioBase = (varianteId && bid) ? ultimosVariante.get(`${varianteId}-${bid}`) : null
          const baseA      = bid ? ultimosBase.get(`${articuloId}-${bid}`) : null
          const fuente     = propioBase ?? baseA
          const precio = fuente && lista.porcentaje != null ? fuente.precio * (1 + Number(lista.porcentaje) / 100) : null
          const heredado = varianteId ? (!propioBase && !!baseA) : false
          return { lista_id: lista.id, lista_nombre: lista.nombre, tipo: lista.tipo, categoria: lista.categoria, precio, vigente_desde: fuente?.vigente_desde ?? null, heredado }
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
    const { data, error } = await supabase.rpc('buscar_articulos', {
      p_query: q.trim(),
      p_limit: 50,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    enriched = await enrichVariantes(data ?? []) as EnrichedRow[]
  } else {
    let query = supabase
      .from('articulos')
      .select(`id, codigo, nombre, tipo_articulo, precio_venta, stock_actual, activo,
        categorias(id, nombre), subcategorias(id, nombre), marcas(id, nombre),
        articulo_variantes(${VARIANTES_SELECT})`)
      .order('nombre')

    if (soloActivos) query = query.eq('activo', true)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    enriched = (data ?? []) as EnrichedRow[]
  }

  const withStock = await enrichStock(enriched)
  return NextResponse.json(await enrichPrecios(withStock))
}

const ROLES_ESCRITURA = ['Administrador', 'Supervisor']

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ROLES_ESCRITURA.includes(session.user.role)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
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
