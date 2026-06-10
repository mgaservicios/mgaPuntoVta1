import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/services/supabase-tenant'
import { requireAdmin, requirePermission } from '@/lib/require-permission'

export async function GET() {
  const session = await requirePermission('admin.usuarios.ver')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, name, role_id, user_sucursales(sucursal_id, sucursales(id, nombre))')
    .order('name')

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

  const { data: roles } = await supabase.from('roles').select('id, name')
  const rolesMap = Object.fromEntries((roles ?? []).map((r) => [r.id, r.name]))

  const data = (users ?? []).map((u) => ({
    ...u,
    role_name: rolesMap[u.role_id] ?? '—',
  }))

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { name, email, password, role_id, sucursal_ids } = await req.json()

  if (!email?.trim() || !password || !name?.trim()) {
    return NextResponse.json({ error: 'Nombre, email y contraseña son obligatorios' }, { status: 400 })
  }

  let userId: string

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  })

  if (authError) {
    if (!authError.message.toLowerCase().includes('already been registered')) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // El usuario ya existe en Supabase Auth pero puede no tener perfil en la tabla users.
    // Buscarlo por email para recuperar su ID y completar el alta.
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const orphan = (listData?.users ?? []).find(
      (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
    )
    if (!orphan) {
      return NextResponse.json({ error: 'Ya existe un usuario registrado con ese email' }, { status: 409 })
    }

    // Verificar si ya tiene perfil completo
    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', orphan.id)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json({ error: 'Ya existe un usuario registrado con ese email' }, { status: 409 })
    }

    // Usuario huérfano: tiene auth pero no perfil. Actualizar password y crear perfil.
    await supabase.auth.admin.updateUserById(orphan.id, { password, email_confirm: true })
    userId = orphan.id
  } else {
    userId = authUser.user.id
  }

  const { error: profileError } = await supabase
    .from('users')
    .insert({ id: userId, email: email.trim(), name: name.trim(), role_id })

  if (profileError) {
    // Solo borrar de auth si era un usuario recién creado (no huérfano recuperado)
    if (!authError) await supabase.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (sucursal_ids?.length) {
    await supabase
      .from('user_sucursales')
      .insert(sucursal_ids.map((sid: number) => ({ user_id: userId, sucursal_id: sid })))
  }

  return NextResponse.json({ id: userId }, { status: 201 })
}
