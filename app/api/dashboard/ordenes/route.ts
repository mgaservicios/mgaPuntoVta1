import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { getHomeSucursalId, assertActiveSucursalIsHome, getSucursalFilter } from '@/lib/sucursal'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { sucursalId, verTodas } = await getSucursalFilter()
  if (!sucursalId && !verTodas) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  const q = searchParams.get('q')

  let query = supabase
    .from('ordenes_venta')
    .select('id, numero, fecha, vencimiento, estado, condicion_pago, total, cliente_id, clientes(nombre), orden_venta_pagos(monto)')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(verTodas ? 500 : 200)

  if (!verTodas && sucursalId) query = query.eq('sucursal_id', sucursalId)
  if (estado && estado !== 'todos') query = query.eq('estado', estado)
  if (desde) query = query.gte('fecha', desde)
  if (hasta) query = query.lte('fecha', hasta)
  if (q) query = query.ilike('numero', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('ventas.ordenes.crear')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const sucursalId = await getHomeSucursalId()
  if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const guardCreate = await assertActiveSucursalIsHome()
  if (guardCreate) return guardCreate

  const body = await req.json()

  const items: {
    articulo_id: number
    variante_id: number | null
    nombre_articulo: string
    descripcion_variante: string | null
    cantidad: number
    precio_unitario: number
    descuento_pct: number
  }[] = body.items ?? []

  if (items.length === 0) return NextResponse.json({ error: 'La orden no tiene ítems' }, { status: 400 })

  const descuento_pct = parseFloat(body.descuento_pct ?? '0') || 0
  const recargo_monto = Math.max(0, parseFloat(body.recargo_monto ?? '0') || 0)

  const itemsConSubtotal = items.map(item => {
    const sub = Math.round(item.cantidad * item.precio_unitario * (1 - item.descuento_pct / 100) * 100) / 100
    return { ...item, subtotal: sub }
  })
  const subtotal = itemsConSubtotal.reduce((acc, i) => acc + i.subtotal, 0)
  const descuento_monto = Math.round(subtotal * (descuento_pct / 100) * 100) / 100
  const total = Math.round((subtotal - descuento_monto + recargo_monto) * 100) / 100

  if (total <= 0) return NextResponse.json({ error: 'El total de la orden debe ser mayor a cero' }, { status: 400 })

  const { data: nextNum } = await supabase.rpc('next_numero_sucursal', { p_sucursal_id: sucursalId, p_tipo: 'orden_venta' })
  const numero = `OV-${String(sucursalId).padStart(2, '0')}-${String(nextNum).padStart(5, '0')}`

  const { data: orden, error: ordenError } = await supabase
    .from('ordenes_venta')
    .insert({
      numero,
      fecha: body.fecha ?? new Date().toISOString().slice(0, 10),
      vencimiento: body.vencimiento || null,
      cliente_id: body.cliente_id ?? null,
      vendedor_id: body.vendedor_id ?? null,
      sucursal_id: sucursalId,
      condicion_pago: body.condicion_pago ?? 'contado',
      subtotal,
      descuento_pct,
      descuento_monto,
      recargo_monto,
      total,
      observaciones: body.observaciones || null,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (ordenError) return NextResponse.json({ error: ordenError.message }, { status: 500 })

  const { error: itemsError } = await supabase
    .from('orden_venta_items')
    .insert(itemsConSubtotal.map(i => ({ ...i, orden_id: orden.id })))

  if (itemsError) {
    await supabase.from('ordenes_venta').delete().eq('id', orden.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  const pagos = body.pagos ?? []
  if (pagos.length > 0) {
    const { error: pagosError } = await supabase
      .from('orden_venta_pagos')
      .insert(pagos.map((p: { metodo: string; monto: number; referencia?: string; fecha_pago?: string; nota_credito_id?: number }) => ({
        orden_id: orden.id,
        metodo: p.metodo,
        monto: p.monto,
        referencia: p.referencia || null,
        fecha_pago: p.fecha_pago || null,
        ...(p.nota_credito_id != null ? { nota_credito_id: p.nota_credito_id } : {}),
      })))

    if (pagosError) {
      await supabase.from('ordenes_venta').delete().eq('id', orden.id)
      return NextResponse.json({ error: pagosError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ id: orden.id, numero }, { status: 201 })
}
