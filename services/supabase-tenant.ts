import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseMaster } from './supabase-master'
import type { Session } from 'next-auth'

const clientCache = new Map<string, SupabaseClient>()

export async function getTenantAdminClient(empresaId: string): Promise<SupabaseClient> {
  if (clientCache.has(empresaId)) return clientCache.get(empresaId)!

  const { data, error } = await supabaseMaster
    .from('empresas')
    .select('supabase_url, supabase_service_key')
    .eq('id', empresaId)
    .single()

  if (error || !data) throw new Error(`Empresa ${empresaId} no encontrada en master DB`)

  const client = createClient(
    data.supabase_url as string,
    data.supabase_service_key as string,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  clientCache.set(empresaId, client)
  return client
}

export async function getTenantClient(session: Session): Promise<SupabaseClient> {
  if (!session.user.empresa_id) {
    throw new Error('Sesión sin empresa_id — el usuario debe volver a iniciar sesión')
  }
  return getTenantAdminClient(session.user.empresa_id)
}
