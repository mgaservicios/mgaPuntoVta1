import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { requirePermission } from '@/lib/require-permission'
import { getActiveSucursalId } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)
  const activeSucursalId = await getActiveSucursalId()

  const { id } = await params

  const { data, error } = await supabase
    .from('articulos')
    .select(`
      *,
      categorias(id, nombre),
      subcategorias(id, nombre),
      marcas(id, nombre),
      articulo_stock(sucursal_id, variante_id, stock_actual),
      articulo_variantes(
        *,
        variante_atributos(*, atributo_tipos(nombre))
      )
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // stock_actual de articulos/articulo_variantes es el agregado de todas las
  // sucursales. Para elegir un armazón hay que mirar el de la sucursal activa,
  // así que se expone aparte en el mismo formato que usa el listado.
  type StockRow = { sucursal_id: number; variante_id: number | null; stock_actual: number }
  const porVariante = new Map<number, StockRow[]>()
  const delArticulo: StockRow[] = []

  for (const s of ((data as unknown as { articulo_stock?: StockRow[] }).articulo_stock ?? [])) {
    if (s.variante_id === null) delArticulo.push(s)
    else porVariante.set(s.variante_id, [...(porVariante.get(s.variante_id) ?? []), s])
  }

  const marcarSucursal = (rows: StockRow[]) =>
    rows.map(r => ({ ...r, is_active: r.sucursal_id === activeSucursalId }))

  const conVariantes = data.tipo_articulo === 'con_variantes'
  const variantes = (data.articulo_variantes ?? []) as unknown as Array<Record<string, unknown> & { id: number }>

  return NextResponse.json({
    ...data,
    articulo_stock: undefined,
    stock_sucursales: marcarSucursal(delArticulo),
    stock_sucursal_actual: conVariantes
      ? Number(
          variantes.reduce(
            (acc, v) => acc + (porVariante.get(v.id) ?? []).filter(r => r.sucursal_id === activeSucursalId)
              .reduce((a, r) => a + Number(r.stock_actual), 0),
            0,
          ),
        )
      : Number(delArticulo.find(r => r.sucursal_id === activeSucursalId)?.stock_actual ?? 0),
    articulo_variantes: variantes.map(v => ({
      ...v,
      stock_sucursales: marcarSucursal(porVariante.get(v.id) ?? []),
    })),
  })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('inventario.articulos.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
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
  const session = await requirePermission('inventario.articulos.desactivar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { error } = await supabase
    .from('articulos')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
