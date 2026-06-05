import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTenantClient } from '@/services/supabase-tenant'
import { getActiveSucursalId } from '@/lib/sucursal'
import AjustesStockClient from './_client'

export default async function AjustesStockPage() {
  const session = await auth()
  if (!session) redirect('/auth/signin')

  const activeSucursalId = await getActiveSucursalId()
  if (!activeSucursalId) redirect('/api/auth/init-session')

  const supabase = await getTenantClient(session)

  let sucursales: { id: number; nombre: string }[] = []
  if (session.user.role === 'Administrador') {
    const { data } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
    sucursales = (data ?? []) as { id: number; nombre: string }[]
  } else {
    const { data } = await supabase
      .from('user_sucursales')
      .select('sucursales(id, nombre)')
      .eq('user_id', session.user.id)
    sucursales = (data ?? [])
      .flatMap(r => Array.isArray(r.sucursales) ? r.sucursales : [r.sucursales])
      .filter(Boolean) as { id: number; nombre: string }[]
  }

  // Ensure the active sucursal is always in the list (safety net)
  if (!sucursales.some(s => s.id === activeSucursalId)) {
    const { data } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .eq('id', activeSucursalId)
      .single()
    if (data) sucursales = [data as { id: number; nombre: string }, ...sucursales]
  }

  return (
    <AjustesStockClient
      activeSucursalId={activeSucursalId}
      sucursales={sucursales}
    />
  )
}
