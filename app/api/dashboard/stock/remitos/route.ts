import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getSucursalFilter, getHomeSucursalId, assertActiveSucursalIsHome } from '@/lib/sucursal'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { sucursalId, verTodas } = await getSucursalFilter()
  if (!sucursalId && !verTodas) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const tipo = searchParams.get('tipo')
  const estado = searchParams.get('estado')

  let query = supabase
    .from('remitos')
    .select('id, numero, tipo, sucursal_id, contraparte_tipo, contraparte_nombre, contraparte_sucursal_id, contraparte_proveedor_id, fecha, estado, created_at')
    .order('created_at', { ascending: false })
    .limit(verTodas ? 500 : 200)
  if (!verTodas && sucursalId) query = query.eq('sucursal_id', sucursalId)
  if (tipo && tipo !== 'todos') query = query.eq('tipo', tipo)
  if (estado && estado !== 'todos') query = query.eq('estado', estado)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = data ?? []

  const provIds = [...new Set(list.filter(r => r.contraparte_proveedor_id).map(r => r.contraparte_proveedor_id as number))]
  // Collect both contraparte sucursal ids AND origin sucursal ids (for verTodas)
  const contraparteSucIds = [...new Set(list.filter(r => r.contraparte_sucursal_id).map(r => r.contraparte_sucursal_id as number))]
  const originSucIds = verTodas ? [...new Set(list.map(r => r.sucursal_id).filter(Boolean) as number[])] : []
  const allSucIds = [...new Set([...contraparteSucIds, ...originSucIds])]

  const [provsRes, sucsRes] = await Promise.all([
    provIds.length
      ? supabase.from('proveedores').select('id, nombre').in('id', provIds)
      : Promise.resolve({ data: [] as { id: number; nombre: string }[] }),
    allSucIds.length
      ? supabase.from('sucursales').select('id, nombre').in('id', allSucIds)
      : Promise.resolve({ data: [] as { id: number; nombre: string }[] }),
  ])

  const provMap = Object.fromEntries((provsRes.data ?? []).map(p => [p.id, p.nombre]))
  const sucMap = Object.fromEntries((sucsRes.data ?? []).map(s => [s.id, s.nombre]))

  const enriched = list.map(r => ({
    ...r,
    nombre_sucursal: verTodas ? (sucMap[r.sucursal_id] ?? null) : undefined,
    contraparte_display:
      r.contraparte_tipo === 'persona' ? (r.contraparte_nombre ?? '—') :
      r.contraparte_tipo === 'proveedor' ? (provMap[r.contraparte_proveedor_id!] ?? '—') :
      r.contraparte_tipo === 'sucursal' ? (sucMap[r.contraparte_sucursal_id!] ?? '—') : '—',
  }))

  return NextResponse.json(enriched)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const sucursalId = await getHomeSucursalId()
  if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const guardCreate = await assertActiveSucursalIsHome()
  if (guardCreate) return guardCreate

  const body = await req.json()
  const {
    tipo, contraparte_tipo, contraparte_sucursal_id, contraparte_proveedor_id,
    contraparte_nombre, fecha, observaciones, items, vendedor_id,
  } = body

  if (!tipo || !contraparte_tipo || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const prefix = tipo === 'entrada' ? 'E' : 'S'
  const { count } = await supabase.from('remitos').select('id', { count: 'exact', head: true })
  const numero = `${prefix}-${String((count ?? 0) + 1).padStart(5, '0')}`

  const { data: remito, error: errRemito } = await supabase
    .from('remitos')
    .insert({
      numero,
      tipo,
      sucursal_id: sucursalId,
      contraparte_tipo,
      contraparte_sucursal_id: contraparte_sucursal_id ?? null,
      contraparte_proveedor_id: contraparte_proveedor_id ?? null,
      contraparte_nombre: contraparte_nombre?.trim() || null,
      fecha: fecha || new Date().toISOString(),
      observaciones: observaciones?.trim() || null,
      vendedor_id: vendedor_id ?? null,
      estado: 'borrador',
      created_by: session.user.id,
    })
    .select()
    .single()

  if (errRemito) return NextResponse.json({ error: errRemito.message }, { status: 500 })

  type ItemInput = {
    articulo_id: number
    variante_id?: number | null
    cantidad: number
    costo_unitario?: number | null
  }
  const rows = (items as ItemInput[]).map(item => ({
    remito_id: remito.id,
    articulo_id: item.articulo_id,
    variante_id: item.variante_id ?? null,
    cantidad: item.cantidad,
    costo_unitario: item.costo_unitario ?? null,
  }))

  const { error: errItems } = await supabase.from('remito_items').insert(rows)
  if (errItems) {
    await supabase.from('remitos').delete().eq('id', remito.id)
    return NextResponse.json({ error: errItems.message }, { status: 500 })
  }

  return NextResponse.json(remito, { status: 201 })
}
