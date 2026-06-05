import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

type Ctx = { params: Promise<{ id: string }> }

const ROLES_ESCRITURA = ['Administrador', 'Supervisor']

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ROLES_ESCRITURA.includes(session.user.role)) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id: articulo_id } = await params
  const body = await req.json()
  const {
    sku, codigo_barras, precio_venta, precio_compra,
    stock_minimo = 0, activo = true,
    atributos = [],
  } = body

  const { data: variante, error: errVariante } = await supabase
    .from('articulo_variantes')
    .insert({
      articulo_id: Number(articulo_id),
      sku: sku?.trim() || null,
      codigo_barras: codigo_barras?.trim() || null,
      precio_venta: precio_venta ?? null,
      precio_compra: precio_compra ?? null,
      stock_minimo,
      activo,
    })
    .select()
    .single()

  if (errVariante) return NextResponse.json({ error: errVariante.message }, { status: 500 })

  if (atributos.length > 0) {
    const rows = atributos.map((a: { atributo_tipo_id: number; valor: string }) => ({
      variante_id: variante.id,
      atributo_tipo_id: a.atributo_tipo_id,
      valor: a.valor.trim(),
    }))
    const { error: errAtrib } = await supabase
      .from('variante_atributos')
      .insert(rows)
    if (errAtrib) return NextResponse.json({ error: errAtrib.message }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('articulo_variantes')
    .select('*, variante_atributos(*, atributo_tipos(nombre))')
    .eq('id', variante.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
