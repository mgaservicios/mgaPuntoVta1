import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { requirePermission } from '@/lib/require-permission'

type Ctx = { params: Promise<{ id: string; varianteId: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('inventario.articulos.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { varianteId } = await params
  const body = await req.json()
  const {
    sku, codigo_barras, precio_venta, precio_compra,
    stock_minimo, activo, atributos,
  } = body

  const { error: errVariante } = await supabase
    .from('articulo_variantes')
    .update({
      sku: sku?.trim() || null,
      codigo_barras: codigo_barras?.trim() || null,
      precio_venta: precio_venta ?? null,
      precio_compra: precio_compra ?? null,
      stock_minimo,
      activo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', varianteId)

  if (errVariante) return NextResponse.json({ error: errVariante.message }, { status: 500 })

  if (Array.isArray(atributos)) {
    await supabase.from('variante_atributos').delete().eq('variante_id', varianteId)
    if (atributos.length > 0) {
      const rows = atributos.map((a: { atributo_tipo_id: number; valor: string }) => ({
        variante_id: Number(varianteId),
        atributo_tipo_id: a.atributo_tipo_id,
        valor: a.valor.trim(),
      }))
      const { error: errAtrib } = await supabase.from('variante_atributos').insert(rows)
      if (errAtrib) return NextResponse.json({ error: errAtrib.message }, { status: 500 })
    }
  }

  const { data, error } = await supabase
    .from('articulo_variantes')
    .select('*, variante_atributos(*, atributo_tipos(nombre))')
    .eq('id', varianteId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('inventario.articulos.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { varianteId } = await params

  const { error } = await supabase
    .from('articulo_variantes')
    .delete()
    .eq('id', varianteId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
