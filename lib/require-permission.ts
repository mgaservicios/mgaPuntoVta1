import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import type { Session } from 'next-auth'

export async function requireAdmin(): Promise<Session | null> {
  const session = await auth()
  if (!session || session.user.role !== 'Administrador') return null
  return session
}

export async function requirePermission(operation: string): Promise<Session | null> {
  const session = await auth()
  if (!session) return null
  if (session.user.role === 'Administrador') return session

  const supabase = await getTenantClient(session)
  const { data } = await supabase
    .from('role_permissions')
    .select('allowed')
    .eq('role_id', session.user.role_id)
    .eq('operation', operation)
    .single()

  if (!data?.allowed) return null
  return session
}
