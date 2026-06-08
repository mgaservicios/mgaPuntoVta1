import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getSucursalFilter, getHomeSucursalId } from '@/lib/sucursal'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json(null, { status: 401 })

  const [{ sucursalId, verTodas }, homeId] = await Promise.all([
    getSucursalFilter(),
    getHomeSucursalId(),
  ])

  if (verTodas) {
    return NextResponse.json({ id: null, nombre: 'Todas las sucursales', isHome: false, verTodas: true })
  }

  if (!sucursalId) {
    return NextResponse.json({ id: null, nombre: null, isHome: true, verTodas: false })
  }

  const supabase = await getTenantClient(session)
  const { data } = await supabase
    .from('sucursales')
    .select('id, nombre')
    .eq('id', sucursalId)
    .single()

  return NextResponse.json({
    id: data?.id ?? null,
    nombre: data?.nombre ?? null,
    isHome: sucursalId === homeId,
    verTodas: false,
  })
}
