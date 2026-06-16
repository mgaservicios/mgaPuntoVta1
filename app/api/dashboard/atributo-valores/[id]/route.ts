import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('altas.atributos.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const { valor } = await req.json()
  if (!valor?.trim()) return NextResponse.json({ error: 'Valor requerido' }, { status: 400 })

  const { data, error } = await supabase
    .from('atributo_valores')
    .update({ valor: valor.trim() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('altas.atributos.eliminar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const { error } = await supabase
    .from('atributo_valores')
    .update({ activo: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
