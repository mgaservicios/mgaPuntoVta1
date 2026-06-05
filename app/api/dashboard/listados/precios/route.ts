import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

export type PrecioRow = {
  articulo_id: number
  variante_id: number | null
  codigo: string | null
  articulo: string
  variante_desc: string | null
  precio: number | null
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { searchParams } = new URL(req.url)
  const listaId = searchParams.get('lista_id')
  const categoriaId = searchParams.get('categoria_id')
  const subcategoriaId = searchParams.get('subcategoria_id')
  const marcaId = searchParams.get('marca_id')

  if (!listaId) return NextResponse.json({ error: 'lista_id es requerido' }, { status: 400 })

  // 1. Metadata de la lista para saber si es calculada
  const { data: lista } = await supabase
    .from('listas_precio')
    .select('id, tipo, porcentaje, lista_base_id')
    .eq('id', parseInt(listaId, 10))
    .single()

  if (!lista) return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })

  // 2. Artículos con filtros
  let q = supabase
    .from('articulos')
    .select(`
      id, codigo, nombre, tipo_articulo,
      articulo_variantes(id, sku, activo,
        variante_atributos(valor, atributo_tipos(nombre))
      )
    `)
    .eq('activo', true)
    .order('nombre')
    .limit(1000)

  if (categoriaId) q = q.eq('categoria_id', parseInt(categoriaId, 10))
  if (subcategoriaId) q = q.eq('subcategoria_id', parseInt(subcategoriaId, 10))
  if (marcaId) q = q.eq('marca_id', parseInt(marcaId, 10))

  const { data: articulos } = await q
  if (!articulos || articulos.length === 0) return NextResponse.json([])

  const articuloIds = articulos.map(a => a.id)

  // 3. Precios — lista objetivo + lista base si es calculada
  const listasToFetch = [parseInt(listaId, 10)]
  if (lista.tipo === 'calculada' && lista.lista_base_id) {
    listasToFetch.push(lista.lista_base_id)
  }

  const { data: preciosData } = await supabase
    .from('precios')
    .select('articulo_id, variante_id, lista_precio_id, precio, vigente_desde')
    .in('lista_precio_id', listasToFetch)
    .in('articulo_id', articuloIds)
    .order('vigente_desde', { ascending: false })
    .limit(10000)

  // Mapa por lista: key `articuloId-varianteId|null` → precio más reciente
  const byList = new Map<number, Map<string, number>>()
  for (const lid of listasToFetch) byList.set(lid, new Map())
  for (const p of preciosData ?? []) {
    const m = byList.get(p.lista_precio_id)
    if (!m) continue
    const key = `${p.articulo_id}-${p.variante_id ?? 'null'}`
    if (!m.has(key)) m.set(key, Number(p.precio))
  }

  const targetMap = byList.get(parseInt(listaId, 10))!
  const baseMap = lista.lista_base_id ? byList.get(lista.lista_base_id) : null

  function getPrecio(articuloId: number, varianteId: number | null): number | null {
    const key = `${articuloId}-${varianteId ?? 'null'}`
    const artKey = `${articuloId}-null` // fallback al nivel artículo

    if (lista.tipo === 'manual') {
      // Precio específico de variante → precio nivel artículo
      return targetMap.get(key) ?? (varianteId !== null ? (targetMap.get(artKey) ?? null) : null)
    }

    // Calculada: override manual tiene prioridad
    const override = targetMap.get(key) ?? (varianteId !== null ? (targetMap.get(artKey) ?? null) : null)
    if (override != null) return override

    // Derivar de la lista base × porcentaje
    if (!baseMap || lista.porcentaje == null) return null
    const base = baseMap.get(key) ?? (varianteId !== null ? (baseMap.get(artKey) ?? null) : null)
    if (base == null) return null
    return Math.round(base * (1 + Number(lista.porcentaje) / 100) * 100) / 100
  }

  // 4. Armar filas
  const rows: PrecioRow[] = []

  for (const a of articulos) {
    if (a.tipo_articulo === 'con_variantes') {
      const variantes = (a.articulo_variantes ?? []).filter((v: Record<string, unknown>) => v.activo)
      if (variantes.length === 0) {
        rows.push({ articulo_id: a.id, variante_id: null, codigo: a.codigo, articulo: a.nombre, variante_desc: null, precio: getPrecio(a.id, null) })
      } else {
        for (const v of variantes) {
          const attrs = (v.variante_atributos ?? []) as { valor: string; atributo_tipos: { nombre: string }[] }[]
          const desc = attrs.map(at => `${at.atributo_tipos?.[0]?.nombre ?? ''}: ${at.valor}`).join(' / ')
          rows.push({
            articulo_id: a.id,
            variante_id: Number(v.id),
            codigo: (v.sku as string | null) ?? a.codigo,
            articulo: a.nombre,
            variante_desc: desc || null,
            precio: getPrecio(a.id, Number(v.id)),
          })
        }
      }
    } else {
      rows.push({ articulo_id: a.id, variante_id: null, codigo: a.codigo, articulo: a.nombre, variante_desc: null, precio: getPrecio(a.id, null) })
    }
  }

  rows.sort((a, b) => a.articulo.localeCompare(b.articulo))
  return NextResponse.json(rows)
}
