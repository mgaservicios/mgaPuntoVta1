import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'

type Ctx = { params: Promise<{ id: string }> }

const REFTABLES = [
  { table: 'remito_items', label: 'Remitos' },
  { table: 'venta_items', label: 'Ventas' },
  { table: 'orden_venta_items', label: 'Órdenes de venta' },
  { table: 'optica_orden_items', label: 'Órdenes de trabajo' },
  { table: 'movimientos_stock', label: 'Movimientos de stock' },
] as const

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('inventario.articulos.desactivar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data: articulo, error: fetchErr } = await supabase
    .from('articulos')
    .select('id, nombre')
    .eq('id', id)
    .single()

  if (fetchErr || !articulo) return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })

  const blockers: string[] = []

  for (const { table, label } of REFTABLES) {
    const { count } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('articulo_id', id)

    if (count && count > 0) blockers.push(`${label} (${count})`)
  }

  if (blockers.length > 0) {
    return NextResponse.json({
      error: 'No se puede eliminar: el artículo tiene relaciones en: ' + blockers.join(', '),
    }, { status: 409 })
  }

  const { error } = await supabase.from('articulos').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, nombre: articulo.nombre })
}
