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

  const [stockResult, sucursalesResult] = await Promise.all([
    supabase
      .from('articulo_stock')
      .select('sucursal_id, variante_id, stock_actual, stock_minimo')
      .eq('articulo_id', id)
      .order('sucursal_id'),
    supabase
      .from('sucursales')
      .select('id, nombre'),
  ])

  if (stockResult.error) return NextResponse.json({ error: stockResult.error.message }, { status: 500 })

  const allSucursales = (sucursalesResult.data ?? []) as Array<{ id: number; nombre: string }>
  const sucNombreMap: Record<number, string> = Object.fromEntries(allSucursales.map(s => [s.id, s.nombre]))

  type StockRow = {
    sucursal_id: number
    variante_id: number | null
    stock_actual: number
    stock_minimo: number
    sucursales: { nombre: string }[]
    is_active: boolean
  }

  const rows: StockRow[] = (stockResult.data ?? []).map(row => ({
    sucursal_id: row.sucursal_id,
    variante_id: row.variante_id,
    stock_actual: row.stock_actual,
    stock_minimo: row.stock_minimo,
    sucursales: [{ nombre: sucNombreMap[row.sucursal_id] ?? '' }],
    is_active: row.sucursal_id === activeSucursalId,
  }))

  // Ensure ALL sucursales appear for the base article (variante_id: null)
  const existingSimpleIds = new Set(rows.filter(r => r.variante_id === null).map(r => r.sucursal_id))
  for (const suc of allSucursales) {
    if (!existingSimpleIds.has(suc.id)) {
      rows.push({ sucursal_id: suc.id, variante_id: null, stock_actual: 0, stock_minimo: 0, sucursales: [{ nombre: suc.nombre }], is_active: suc.id === activeSucursalId })
    }
  }

  return NextResponse.json(rows)
}
