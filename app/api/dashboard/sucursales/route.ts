import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const isAdmin = session.user.role === 'Administrador'

  if (isAdmin) {
    const { data, error } = await supabase
      .from('sucursales')
      .select('id, nombre, direccion, activo')
      .eq('activo', true)
      .order('nombre')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from('user_sucursales')
    .select('sucursales(id, nombre, direccion, activo)')
    .eq('user_id', session.user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sucursales = (data ?? [])
    .flatMap((row) => (Array.isArray(row.sucursales) ? row.sucursales : [row.sucursales]))
    .filter((s) => s !== null && !!s && (s as { activo: boolean }).activo)

  return NextResponse.json(sucursales)
}
