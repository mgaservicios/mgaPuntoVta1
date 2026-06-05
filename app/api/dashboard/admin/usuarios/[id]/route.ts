import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/services/supabase-tenant'
import { requireAdmin, requirePermission } from '@/lib/require-permission'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('admin.usuarios.ver')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, role_id, user_sucursales(sucursal_id)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const { name, email, password, role_id, sucursal_ids } = await req.json()

  if (!name?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  const { error: profileError } = await supabase
    .from('users')
    .update({ name: name.trim(), email: email?.trim(), role_id })
    .eq('id', id)

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  if (password) {
    const { error: pwError } = await supabase.auth.admin.updateUserById(id, { password })
    if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 })
  }

  await supabase.from('user_sucursales').delete().eq('user_id', id)
  if (sucursal_ids?.length) {
    await supabase
      .from('user_sucursales')
      .insert(sucursal_ids.map((sid: number) => ({ user_id: id, sucursal_id: sid })))
  }

  return NextResponse.json({ ok: true })
}
