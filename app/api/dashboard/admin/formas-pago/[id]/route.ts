import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('admin.formas_pago.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)
  const { id } = await params
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.nombre !== undefined) update.nombre = body.nombre.trim()
  if (body.tipo    !== undefined) update.tipo    = body.tipo
  if (body.activo  !== undefined) update.activo  = body.activo
  if (body.orden   !== undefined) update.orden   = body.orden

  const { data, error } = await supabase
    .from('formas_pago')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('admin.formas_pago.eliminar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)
  const { id } = await params

  // Soft delete — solo marcar inactivo
  const { error } = await supabase
    .from('formas_pago')
    .update({ activo: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
