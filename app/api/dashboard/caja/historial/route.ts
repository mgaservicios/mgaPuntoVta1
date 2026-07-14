import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getSucursalFilter } from '@/lib/sucursal'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { sucursalId, verTodas } = await getSucursalFilter()
  if (!sucursalId && !verTodas) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const params = req.nextUrl.searchParams
  const desde = params.get('desde')
  const hasta = params.get('hasta')
  const filtro = params.get('filtro') ?? 'cerradas' // 'abiertas' | 'cerradas' | 'todas'
  const fechaEspecifica = params.get('fecha_especifica') // YYYY-MM-DD

  if (!desde || !DATE_RE.test(desde) || !hasta || !DATE_RE.test(hasta))
    return NextResponse.json({ error: 'desde y hasta requeridos (YYYY-MM-DD)' }, { status: 400 })

  let q = supabase
    .from('caja_sesiones')
    .select('id, fecha_apertura, fecha_cierre, monto_apertura, monto_cierre, monto_esperado, diferencia, observaciones, estado, usuario_id, fecha, sucursales(nombre)')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha_apertura', { ascending: false })

  // Filtrar por estado según el parámetro filtro
  if (filtro === 'abiertas') {
    q = q.eq('estado', 'abierta')
  } else if (filtro === 'cerradas') {
    q = q.eq('estado', 'cerrada')
  }
  // 'todas' no agrega filtro de estado

  // Filtrar por fecha específica si se proporciona
  if (fechaEspecifica && DATE_RE.test(fechaEspecifica)) {
    q = q.eq('fecha', fechaEspecifica)
  }

  if (!verTodas && sucursalId) q = q.eq('sucursal_id', sucursalId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
