import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getActiveSucursalId, getSucursalFilter } from '@/lib/sucursal'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  const q = searchParams.get('q')

  const { sucursalId, verTodas } = await getSucursalFilter()

  let query = supabase
    .from('optica_ordenes')
    .select(`
      id, numero, fecha, fecha_prometida, estado, total, subtotal, descuento_monto,
      cliente_id, clientes(nombre),
      optica_orden_pagos(monto),
      optica_orden_tareas(id, estado)
    `)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (!verTodas && sucursalId) query = query.eq('sucursal_id', sucursalId)
  if (estado && estado !== 'todos') query = query.eq('estado', estado)
  if (desde) query = query.gte('fecha', desde)
  if (hasta) query = query.lte('fecha', hasta)
  if (q) {
    const { data: clientesMatch } = await supabase
      .from('clientes')
      .select('id')
      .ilike('nombre', `%${q}%`)
      .limit(200)
    const clienteIds = (clientesMatch ?? []).map(c => c.id)
    if (clienteIds.length > 0) {
      query = query.or(`numero.ilike.%${q}%,cliente_id.in.(${clienteIds.join(',')})`)
    } else {
      query = query.ilike('numero', `%${q}%`)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const sucursalId = await getActiveSucursalId()
  if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const body = await req.json()

  const items: {
    tipo: string
    uso: string | null
    nombre: string
    armazon_propio: boolean
    articulo_id: number | null
    variante_id: number | null
    cantidad: number
    precio_unitario: number
    descuento_pct: number
    notas: string | null
  }[] = body.items ?? []

  const costo_trabajo = Math.max(0, parseFloat(body.costo_trabajo ?? '0') || 0)
  const anticipo      = Math.max(0, parseFloat(body.anticipo ?? '0') || 0)
  const descuento_pct = parseFloat(body.descuento_pct ?? '0') || 0

  const itemsConSubtotal = items.map(item => {
    const sub = Math.round(item.cantidad * item.precio_unitario * (1 - item.descuento_pct / 100) * 100) / 100
    return { ...item, subtotal: sub }
  })

  const items_subtotal  = itemsConSubtotal.reduce((acc, i) => acc + i.subtotal, 0)
  const subtotal        = Math.round((items_subtotal + costo_trabajo) * 100) / 100
  const descuento_monto = Math.min(
    Math.max(0, parseFloat(body.descuento_monto ?? '0') || 0),
    subtotal,
  )
  const total = Math.round((subtotal - descuento_monto) * 100) / 100

  const { count } = await supabase.from('optica_ordenes').select('id', { count: 'exact', head: true })
  const numero = `OT-${String((count ?? 0) + 1).padStart(5, '0')}`

  const { data: orden, error: ordenError } = await supabase
    .from('optica_ordenes')
    .insert({
      numero,
      fecha: body.fecha ?? new Date().toISOString().slice(0, 10),
      fecha_prometida: body.fecha_prometida || null,
      cliente_id: body.cliente_id ?? null,
      medico_id: body.medico_id ?? null,
      medico_nombre: body.medico_nombre?.trim() || null,
      receta_url: body.receta_url || null,
      lejos_od_esfera: body.lejos_od_esfera ?? null,
      lejos_od_cilindro: body.lejos_od_cilindro ?? null,
      lejos_od_eje: body.lejos_od_eje ?? null,
      lejos_oi_esfera: body.lejos_oi_esfera ?? null,
      lejos_oi_cilindro: body.lejos_oi_cilindro ?? null,
      lejos_oi_eje: body.lejos_oi_eje ?? null,
      cerca_od_esfera: body.cerca_od_esfera ?? null,
      cerca_od_cilindro: body.cerca_od_cilindro ?? null,
      cerca_od_eje: body.cerca_od_eje ?? null,
      cerca_oi_esfera: body.cerca_oi_esfera ?? null,
      cerca_oi_cilindro: body.cerca_oi_cilindro ?? null,
      cerca_oi_eje: body.cerca_oi_eje ?? null,
      adicion: body.adicion ?? null,
      dp: body.dp ?? null,
      observaciones: body.observaciones?.trim() || null,
      costo_trabajo,
      anticipo,
      subtotal,
      descuento_pct,
      descuento_monto,
      total,
      sucursal_id: sucursalId,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (ordenError) return NextResponse.json({ error: ordenError.message }, { status: 500 })

  if (itemsConSubtotal.length > 0) {
    const { error: itemsError } = await supabase
      .from('optica_orden_items')
      .insert(itemsConSubtotal.map(i => ({ ...i, orden_id: orden.id })))

    if (itemsError) {
      await supabase.from('optica_ordenes').delete().eq('id', orden.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }
  }

  // Crear pago de seña si se indicó anticipo con método
  const anticipo_metodo: string | undefined = body.anticipo_metodo
  const METODOS_VALIDOS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CUENTA_CORRIENTE', 'CHEQUE', 'OTRO']
  if (anticipo > 0 && anticipo_metodo && METODOS_VALIDOS.includes(anticipo_metodo)) {
    let cajaSesionId: number | null = null
    if (sucursalId) {
      const { data: caja } = await supabase
        .from('caja_sesiones')
        .select('id')
        .eq('sucursal_id', sucursalId)
        .eq('estado', 'abierta')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      cajaSesionId = caja?.id ?? null
    }
    await supabase.from('optica_orden_pagos').insert({
      orden_id: orden.id,
      caja_sesion_id: cajaSesionId,
      metodo: anticipo_metodo,
      monto: anticipo,
      concepto: 'SEÑA',
      fecha_pago: new Date().toISOString().slice(0, 10),
      usuario_id: session.user.id,
    })
    if (cajaSesionId) {
      await supabase.from('caja_movimientos').insert({
        sesion_id: cajaSesionId,
        tipo: 'ingreso',
        concepto: `${numero} – SEÑA`,
        monto: anticipo,
        usuario_id: session.user.id,
      })
    }
  }

  return NextResponse.json({ id: orden.id, numero }, { status: 201 })
}
