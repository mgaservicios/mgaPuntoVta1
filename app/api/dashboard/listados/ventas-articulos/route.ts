import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getSucursalFilter } from '@/lib/sucursal'

export type VentaArticuloRow = {
  fecha: string
  comprobante: string
  tipo_origen: 'venta' | 'orden' | 'optica'
  cliente: string | null
  articulo: string
  cantidad: number
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { sucursalId, verTodas } = await getSucursalFilter()
  if (!sucursalId && !verTodas) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  const tipo = searchParams.get('tipo') ?? 'todos'

  let rows: VentaArticuloRow[] = []

  if (tipo === 'todos' || tipo === 'venta') {
    const [v, o] = await Promise.all([
      queryVentas(supabase, sucursalId, verTodas, desde, hasta),
      queryOrdenes(supabase, sucursalId, verTodas, desde, hasta),
    ])
    rows = rows.concat(v, o)
  }

  if (tipo === 'todos' || tipo === 'receta') {
    const opt = await queryOptica(supabase, sucursalId, verTodas, desde, hasta)
    rows = rows.concat(opt)
  }

  rows.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.comprobante.localeCompare(a.comprobante))

  return NextResponse.json(rows)
}

async function queryVentas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, sucursalId: number | null, verTodas: boolean,
  desde: string | null, hasta: string | null,
): Promise<VentaArticuloRow[]> {
  let q = supabase
    .from('ventas')
    .select('numero, fecha, clientes(nombre), venta_items(nombre_articulo, descripcion_variante, cantidad)')
    .eq('estado', 'completada')
    .order('fecha', { ascending: false })
    .limit(500)

  if (!verTodas && sucursalId) q = q.eq('sucursal_id', sucursalId)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)

  const { data } = await q
  if (!data) return []

  return (data as any[]).flatMap((v: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
    (v.venta_items ?? []).map((item: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const nombreVar = item.descripcion_variante
        ? `${item.nombre_articulo} — ${item.descripcion_variante}`
        : item.nombre_articulo
      return {
        fecha: v.fecha,
        comprobante: v.numero,
        tipo_origen: 'venta' as const,
        cliente: v.clientes?.nombre ?? null,
        articulo: nombreVar,
        cantidad: Number(item.cantidad),
      }
    })
  )
}

async function queryOrdenes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, sucursalId: number | null, verTodas: boolean,
  desde: string | null, hasta: string | null,
): Promise<VentaArticuloRow[]> {
  let q = supabase
    .from('ordenes_venta')
    .select('numero, fecha, clientes(nombre), orden_venta_items(nombre_articulo, descripcion_variante, cantidad)')
    .eq('estado', 'confirmada')
    .order('fecha', { ascending: false })
    .limit(500)

  if (!verTodas && sucursalId) q = q.eq('sucursal_id', sucursalId)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)

  const { data } = await q
  if (!data) return []

  return (data as any[]).flatMap((o: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
    (o.orden_venta_items ?? []).map((item: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const nombreVar = item.descripcion_variante
        ? `${item.nombre_articulo} — ${item.descripcion_variante}`
        : item.nombre_articulo
      return {
        fecha: o.fecha,
        comprobante: o.numero,
        tipo_origen: 'orden' as const,
        cliente: o.clientes?.nombre ?? null,
        articulo: nombreVar,
        cantidad: Number(item.cantidad),
      }
    })
  )
}

async function queryOptica(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, sucursalId: number | null, verTodas: boolean,
  desde: string | null, hasta: string | null,
): Promise<VentaArticuloRow[]> {
  let q = supabase
    .from('optica_ordenes')
    .select('numero, fecha, clientes(nombre), optica_orden_items(nombre, articulo_id, cantidad)')
    .neq('estado', 'anulado')
    .order('fecha', { ascending: false })
    .limit(500)

  if (!verTodas && sucursalId) q = q.eq('sucursal_id', sucursalId)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)

  const { data } = await q
  if (!data) return []

  return (data as any[]).flatMap((o: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
    (o.optica_orden_items ?? [])
      .filter((item: any) => item.articulo_id != null) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((item: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        fecha: o.fecha,
        comprobante: o.numero,
        tipo_origen: 'optica' as const,
        cliente: o.clientes?.nombre ?? null,
        articulo: item.nombre,
        cantidad: Number(item.cantidad),
      }))
  )
}
