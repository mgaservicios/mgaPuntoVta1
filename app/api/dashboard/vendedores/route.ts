import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getSucursalFilter } from '@/lib/sucursal'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { sucursalId, verTodas } = await getSucursalFilter()

  let query = supabase
    .from('vendedores')
    .select('id, nombre, sucursal_id')
    .eq('activo', true)
    .order('nombre')

  if (!verTodas && sucursalId) {
    query = query.eq('sucursal_id', sucursalId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
