import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { searchParams } = req.nextUrl
  const q          = searchParams.get('q')?.trim() ?? ''
  const fechaDesde = searchParams.get('fecha_desde')
  const fechaHasta = searchParams.get('fecha_hasta')

  // IDs de todas las listas de costo activas
  const { data: listasData } = await supabase
    .from('listas_precio')
    .select('id, nombre')
    .eq('categoria', 'costo')

  const listasIds = (listasData ?? []).map((l: { id: number }) => l.id)
  if (listasIds.length === 0) return NextResponse.json([])

  let query = supabase
    .from('precios')
    .select(`
      id, articulo_id, variante_id, lista_precio_id, precio, vigente_desde, origen_tipo,
      lista_precio:lista_precio_id(id, nombre),
      articulo:articulo_id(id, codigo, nombre),
      variante:variante_id(id, sku, variante_atributos(valor, atributo_tipos(nombre))),
      proveedor:origen_proveedor_id(nombre),
      remito:remito_id(numero)
    `)
    .in('lista_precio_id', listasIds)
    .order('articulo_id', { ascending: true })
    .order('vigente_desde', { ascending: false })
    .limit(3000)

  if (fechaDesde) query = query.gte('vigente_desde', fechaDesde)
  if (fechaHasta) query = query.lte('vigente_desde', fechaHasta + 'T23:59:59')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let entries = (data ?? []) as Record<string, unknown>[]

  if (q) {
    const lower = q.toLowerCase()
    entries = entries.filter(e => {
      const art = e.articulo as { nombre?: string; codigo?: string } | null
      return (
        art?.nombre?.toLowerCase().includes(lower) ||
        art?.codigo?.toLowerCase().includes(lower)
      )
    })
  }

  return NextResponse.json(entries)
}
