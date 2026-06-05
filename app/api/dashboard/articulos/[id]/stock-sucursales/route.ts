import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getActiveSucursalId } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)
  const activeSucursalId = await getActiveSucursalId()

  const { id } = await params

  const { data, error } = await supabase
    .from('articulo_stock')
    .select('sucursal_id, variante_id, stock_actual, stock_minimo, sucursales(nombre)')
    .eq('articulo_id', id)
    .order('sucursal_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map((row) => ({
    ...row,
    is_active: row.sucursal_id === activeSucursalId,
  }))

  // Ensure the active sucursal always appears (shows 0 when it has no stock rows)
  if (activeSucursalId && !rows.some(r => r.sucursal_id === activeSucursalId)) {
    const { data: sucData } = await supabase
      .from('sucursales')
      .select('nombre')
      .eq('id', activeSucursalId)
      .maybeSingle()

    if (sucData) {
      rows.push({
        sucursal_id: activeSucursalId,
        variante_id: null,
        stock_actual: 0,
        stock_minimo: 0,
        sucursales: { nombre: (sucData as { nombre: string }).nombre },
        is_active: true,
      })
    }
  }

  return NextResponse.json(rows)
}
