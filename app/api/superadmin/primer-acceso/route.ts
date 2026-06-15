import { NextRequest, NextResponse } from 'next/server'
import { validateSuperadminCookie } from '@/lib/superadmin-auth'
import { supabaseMaster } from '@/services/supabase-master'
import { getTenantAdminClient } from '@/services/supabase-tenant'

export async function POST(req: NextRequest) {
  const cookieVal = req.cookies.get('sa_session')?.value
  if (!cookieVal || !validateSuperadminCookie(cookieVal)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { empresa_id, nombre, email, password, nombre_sucursal } = body

  if (!empresa_id || !nombre?.trim() || !email?.trim() || !password || !nombre_sucursal?.trim()) {
    return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 })
  }

  const { data: empresa, error: lookupError } = await supabaseMaster
    .from('empresas')
    .select('id, nombre, codigo')
    .eq('id', empresa_id)
    .single()

  if (lookupError || !empresa) {
    return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  }

  let tenant: Awaited<ReturnType<typeof getTenantAdminClient>>
  try {
    tenant = await getTenantAdminClient(empresa_id)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al conectar con el tenant' },
      { status: 500 }
    )
  }

  // Guard: no re-inicializar si ya tiene usuarios
  const { count } = await tenant
    .from('users')
    .select('id', { count: 'exact', head: true })

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'La empresa ya tiene usuarios registrados' }, { status: 409 })
  }

  // Crear usuario en auth del tenant
  const { data: authData, error: authError } = await tenant.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  })

  if (authError || !authData?.user) {
    return NextResponse.json({ error: authError?.message ?? 'Error al crear usuario' }, { status: 500 })
  }

  const userId = authData.user.id

  // Obtener role_id del Administrador
  const { data: rolData, error: rolError } = await tenant
    .from('roles')
    .select('id')
    .eq('name', 'Administrador')
    .single()

  if (rolError || !rolData) {
    await tenant.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'No se encontró el rol Administrador en el tenant' }, { status: 500 })
  }

  // Crear perfil en public.users
  const { error: profileError } = await tenant
    .from('users')
    .insert({ id: userId, email: email.trim(), name: nombre.trim(), role_id: rolData.id })

  if (profileError) {
    await tenant.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Crear sucursal
  const { data: sucursal, error: sucursalError } = await tenant
    .from('sucursales')
    .insert({ nombre: nombre_sucursal.trim() })
    .select('id')
    .single()

  if (sucursalError || !sucursal) {
    await tenant.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: sucursalError?.message ?? 'Error al crear sucursal' }, { status: 500 })
  }

  // Asignar usuario a sucursal
  await tenant
    .from('user_sucursales')
    .insert({ user_id: userId, sucursal_id: sucursal.id })

  // Marcar empresa como activa en master
  await supabaseMaster
    .from('empresas')
    .update({ estado_implementacion: 'activo' })
    .eq('id', empresa_id)

  return NextResponse.json({
    ok: true,
    message: `Primer acceso configurado para "${empresa.nombre}" (${empresa.codigo})`,
  })
}
