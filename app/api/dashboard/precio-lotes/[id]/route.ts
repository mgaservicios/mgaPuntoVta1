import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/services/supabase-tenant'
import { requirePermission } from '@/lib/require-permission'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission('inventario.articulos.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data: lote, error: fetchError } = await supabase
    .from('precio_lotes')
    .select('id, estado, items_count')
    .eq('id', id)
    .single()

  if (fetchError || !lote) return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })
  if ((lote as unknown as { estado: string }).estado === 'revertido')
    return NextResponse.json({ error: 'Este lote ya fue revertido' }, { status: 400 })

  // Eliminar todos los precios de este lote
  const { error: delError } = await supabase
    .from('precios')
    .delete()
    .eq('lote_id', id)

  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

  // Marcar el lote como revertido
  const { error: updError } = await supabase
    .from('precio_lotes')
    .update({
      estado: 'revertido',
      revertido_at: new Date().toISOString(),
      revertido_by: session.user.id,
    })
    .eq('id', id)

  if (updError) return NextResponse.json({ error: updError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
