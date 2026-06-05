import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { ALL_OPERATIONS } from '@/lib/perm-groups'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'Administrador') return null
  return session
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const roleId = req.nextUrl.searchParams.get('role_id')
  if (!roleId) return NextResponse.json({ error: 'role_id requerido' }, { status: 400 })

  const { data } = await supabase
    .from('role_permissions')
    .select('operation, allowed')
    .eq('role_id', roleId)

  const existingMap = Object.fromEntries((data ?? []).map((p) => [p.operation, p.allowed]))

  const permissions = ALL_OPERATIONS.map((op) => ({
    operation: op,
    allowed: existingMap[op] ?? false,
  }))

  return NextResponse.json({ operations: ALL_OPERATIONS, permissions })
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { role_id, permissions } = await req.json()
  if (!role_id || !Array.isArray(permissions)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const rows = permissions.map((p: { operation: string; allowed: boolean }) => ({
    role_id,
    operation: p.operation,
    allowed: p.allowed,
  }))

  const { error } = await supabase
    .from('role_permissions')
    .upsert(rows, { onConflict: 'role_id,operation' })

  if (error) {
    console.error('[permisos PUT]', error)
    return NextResponse.json({ error: error.message, details: error }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
