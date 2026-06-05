import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { NextResponse } from 'next/server'
import { ALL_OPERATIONS } from '@/lib/perm-groups'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (session.user.role === 'Administrador') {
    const all = Object.fromEntries(ALL_OPERATIONS.map((op) => [op, true]))
    return NextResponse.json(all)
  }

  const supabase = await getTenantClient(session)
  const { data } = await supabase
    .from('role_permissions')
    .select('operation, allowed')
    .eq('role_id', session.user.role_id)

  const map = Object.fromEntries((data ?? []).map((r) => [r.operation, r.allowed]))
  return NextResponse.json(map)
}
