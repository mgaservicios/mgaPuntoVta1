import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { registrarPrecio, getPreciosVigentes } from '@/services/precios'
import { requirePermission } from '@/lib/require-permission'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const { searchParams } = req.nextUrl
  const variante_id = searchParams.get('variante_id') ? Number(searchParams.get('variante_id')) : null

  const articulo_id = Number(id)

  let historialQ = supabase
    .from('precios')
    .select(`
      *,
      lista_precio:lista_precio_id(id, nombre, tipo, categoria),
      proveedor:origen_proveedor_id(nombre),
      sucursal:origen_sucursal_id(nombre)
    `)
    .eq('articulo_id', articulo_id)
    .order('lista_precio_id', { ascending: true })
    .order('vigente_desde', { ascending: false })

  if (variante_id) {
    historialQ = historialQ.eq('variante_id', variante_id)
  } else {
    historialQ = historialQ.is('variante_id', null)
  }

  const [vigentes, historialRes] = await Promise.all([
    getPreciosVigentes(articulo_id, variante_id, supabase),
    historialQ,
  ])

  if (historialRes.error) return NextResponse.json({ error: historialRes.error.message }, { status: 500 })

  return NextResponse.json({ vigentes, historial: historialRes.data ?? [] })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('inventario.articulos.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()
  const {
    variante_id,
    lista_precio_id,
    precio,
    vigente_desde,
    origen_tipo = 'manual',
    origen_proveedor_id,
    origen_sucursal_id,
  } = body

  if (!lista_precio_id) return NextResponse.json({ error: 'lista_precio_id es obligatorio' }, { status: 400 })
  if (precio == null || isNaN(Number(precio)) || Number(precio) < 0)
    return NextResponse.json({ error: 'precio inválido' }, { status: 400 })

  // Verificar que la lista es manual
  const { data: lista } = await supabase
    .from('listas_precio')
    .select('tipo')
    .eq('id', lista_precio_id)
    .single()

  if (!lista) return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })
  if (lista.tipo !== 'manual')
    return NextResponse.json({ error: 'Solo se pueden cargar precios en listas manuales' }, { status: 400 })

  const err = await registrarPrecio(
    {
      articulo_id: Number(id),
      variante_id: variante_id ?? null,
      lista_precio_id: Number(lista_precio_id),
      precio: Number(precio),
      vigente_desde,
      origen_tipo,
      origen_proveedor_id: origen_proveedor_id ?? null,
      origen_sucursal_id: origen_sucursal_id ?? null,
      created_by: session.user.id,
    },
    supabase,
  )

  if (err) return NextResponse.json({ error: err }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
