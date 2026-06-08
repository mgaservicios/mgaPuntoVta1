import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getHomeSucursalId } from '@/lib/sucursal'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json(null, { status: 401 })
  const homeId = await getHomeSucursalId()
  if (!homeId) return NextResponse.json(null)

  const supabase = await getTenantClient(session)
  const { data } = await supabase
    .from('sucursales')
    .select('id, nombre')
    .eq('id', homeId)
    .single()

  return NextResponse.json(data ?? null)
}
