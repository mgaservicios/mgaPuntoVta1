import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data, error } = await supabase
    .from('articulos')
    .select(`
      *,
      categorias(id, nombre),
      subcategorias(id, nombre),
      marcas(id, nombre),
      articulo_variantes(
        *,
        variante_atributos(*, atributo_tipos(nombre))
      )
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

const ROLES_ESCRITURA = ['Administrador', 'Supervisor']

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ROLES_ESCRITURA.includes(session.user.role)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()
  const {
    nombre, codigo, descripcion,
    categoria_id, subcategoria_id, marca_id, proveedor_id,
    precio_venta, precio_compra,
    stock_minimo, unidad_id,
    codigo_barras, imagen_url, activo,
  } = body

  if (!nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('articulos')
    .update({
      nombre: nombre.trim(),
      codigo: codigo?.trim() || null,
      descripcion: descripcion?.trim() || null,
      categoria_id: categoria_id || null,
      subcategoria_id: subcategoria_id || null,
      marca_id: marca_id || null,
      proveedor_id: proveedor_id || null,
      precio_venta: precio_venta ?? null,
      precio_compra: precio_compra ?? null,
      stock_minimo,
      unidad_id: unidad_id || null,
      codigo_barras: codigo_barras?.trim() || null,
      imagen_url: imagen_url?.trim() || null,
      activo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ROLES_ESCRITURA.includes(session.user.role)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { error } = await supabase
    .from('articulos')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
