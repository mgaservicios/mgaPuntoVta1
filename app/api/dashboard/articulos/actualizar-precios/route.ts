import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { requirePermission } from '@/lib/require-permission'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { searchParams } = req.nextUrl
  const lista_precio_id = searchParams.get('lista_precio_id')
  const marca_id = searchParams.get('marca_id')
  const categoria_id = searchParams.get('categoria_id')
  const subcategoria_id = searchParams.get('subcategoria_id')
  const codigo = searchParams.get('codigo')

  if (!lista_precio_id) return NextResponse.json({ error: 'lista_precio_id requerido' }, { status: 400 })

  let query = supabase
    .from('articulos')
    .select('id, codigo, nombre, tipo_articulo, articulo_variantes(id, sku)')
    .eq('activo', true)
    .order('nombre')

  if (marca_id) query = query.eq('marca_id', Number(marca_id))
  if (categoria_id) query = query.eq('categoria_id', Number(categoria_id))
  if (subcategoria_id) query = query.eq('subcategoria_id', Number(subcategoria_id))
  if (codigo?.trim()) query = query.ilike('codigo', `%${codigo.trim()}%`)

  const { data: articulos, error: artError } = await query
  if (artError) return NextResponse.json({ error: artError.message }, { status: 500 })
  if (!articulos?.length) return NextResponse.json([])

  const articuloIds = articulos.map((a) => a.id)
  const today = new Date().toISOString().slice(0, 10)

  const { data: preciosData, error: precError } = await supabase
    .from('precios')
    .select('articulo_id, variante_id, precio')
    .eq('lista_precio_id', Number(lista_precio_id))
    .in('articulo_id', articuloIds)
    .lte('vigente_desde', today)
    .order('vigente_desde', { ascending: false })

  if (precError) return NextResponse.json({ error: precError.message }, { status: 500 })

  const precioMap = new Map<string, number>()
  for (const p of (preciosData ?? []) as Array<{ articulo_id: number; variante_id: number | null; precio: number }>) {
    const key = `${p.articulo_id}_${p.variante_id ?? 'null'}`
    if (!precioMap.has(key)) precioMap.set(key, p.precio)
  }

  const result: Array<{
    articulo_id: number
    variante_id: number | null
    codigo: string
    nombre: string
    precio_actual: number | null
  }> = []

  for (const a of (articulos as Array<{
    id: number
    codigo: string | null
    nombre: string
    tipo_articulo: string
    articulo_variantes: Array<{ id: number; sku: string | null }> | null
  }>)) {
    const variantes = a.articulo_variantes ?? []
    if (a.tipo_articulo === 'simple' || variantes.length === 0) {
      result.push({
        articulo_id: a.id,
        variante_id: null,
        codigo: a.codigo ?? '',
        nombre: a.nombre,
        precio_actual: precioMap.get(`${a.id}_null`) ?? null,
      })
    } else {
      for (const v of variantes) {
        result.push({
          articulo_id: a.id,
          variante_id: v.id,
          codigo: v.sku ?? a.codigo ?? '',
          nombre: `${a.nombre}${v.sku ? ` — ${v.sku}` : ''}`,
          precio_actual: precioMap.get(`${a.id}_${v.id}`) ?? null,
        })
      }
    }
  }

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('inventario.articulos.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const body = await req.json() as {
    lista_precio_id: number
    vigente_desde: string
    porcentaje: number
    signo: 'aumento' | 'descuento'
    items: Array<{ articulo_id: number; variante_id: number | null; precio_nuevo: number }>
  }
  const { lista_precio_id, vigente_desde, porcentaje, signo, items } = body

  if (!lista_precio_id || !items?.length)
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })

  const { data: lista } = await supabase
    .from('listas_precio')
    .select('tipo, nombre')
    .eq('id', lista_precio_id)
    .single()
  if (lista?.tipo !== 'manual')
    return NextResponse.json({ error: 'Solo se pueden actualizar listas manuales' }, { status: 400 })

  const fecha = vigente_desde || new Date().toISOString().slice(0, 10)

  // Crear registro del lote antes de insertar precios
  const { data: lote, error: loteError } = await supabase
    .from('precio_lotes')
    .insert({
      lista_precio_id,
      lista_nombre: (lista as unknown as { nombre: string }).nombre ?? '',
      vigente_desde: fecha,
      porcentaje: Number(porcentaje),
      signo: signo ?? 'aumento',
      items_count: items.length,
      created_by: session.user.id,
    })
    .select('id')
    .single()

  if (loteError) return NextResponse.json({ error: loteError.message }, { status: 500 })

  const rows = items.map((item) => ({
    articulo_id: item.articulo_id,
    variante_id: item.variante_id ?? null,
    lista_precio_id,
    precio: item.precio_nuevo,
    vigente_desde: fecha,
    origen_tipo: 'manual',
    created_by: session.user.id,
    lote_id: (lote as unknown as { id: string }).id,
  }))

  const { error } = await supabase.from('precios').insert(rows)
  if (error) {
    // Limpiar el lote si falló la inserción de precios
    await supabase.from('precio_lotes').delete().eq('id', (lote as unknown as { id: string }).id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ updated: rows.length, lote_id: (lote as unknown as { id: string }).id })
}
