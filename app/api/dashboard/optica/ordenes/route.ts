import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { getHomeSucursalId, getSucursalFilter, assertActiveSucursalIsHome } from '@/lib/sucursal'
import { normalizarBusquedaNumero } from '@/lib/busqueda-numero'
import { descontarItemsOptica } from '@/services/stock'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')
  const q = searchParams.get('q')
  const qNumero = normalizarBusquedaNumero(q) ?? q
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10) || 50))

  const { sucursalId, verTodas } = await getSucursalFilter()

  let clienteIds: number[] = []
  if (q) {
    const { data: clientesMatch } = await supabase
      .from('clientes')
      .select('id')
      .ilike('nombre', `%${q}%`)
      .limit(200)
    clienteIds = (clientesMatch ?? []).map(c => c.id)
  }

  // Totales sobre todos los resultados filtrados
  let totalsQuery = supabase
    .from('optica_ordenes')
    .select('id, total, optica_orden_pagos(monto)')
  if (!verTodas && sucursalId) totalsQuery = totalsQuery.eq('sucursal_id', sucursalId)
  if (estado && estado !== 'todos') totalsQuery = totalsQuery.eq('estado', estado)
  if (desde) totalsQuery = totalsQuery.gte('fecha', desde)
  if (hasta) totalsQuery = totalsQuery.lte('fecha', hasta)
  if (qNumero) {
    totalsQuery = clienteIds.length > 0
      ? totalsQuery.or(`numero.ilike.%${qNumero}%,cliente_id.in.(${clienteIds.join(',')})`)
      : totalsQuery.ilike('numero', `%${qNumero}%`)
  }

  const { data: allRows } = await totalsQuery
  const rows = allRows ?? []
  const total = rows.length
  const totalMonto = rows.reduce((s: number, r: { total: number }) => s + Number(r.total ?? 0), 0)
  const totalSaldo = rows.reduce((s: number, r: { total: number; optica_orden_pagos?: { monto: number }[] }) => {
    const pagado = (r.optica_orden_pagos ?? []).reduce((p: number, x: { monto: number }) => p + Number(x.monto), 0)
    return s + Number(r.total ?? 0) - pagado
  }, 0)

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

  if (!verTodas && sucursalId) query = query.eq('sucursal_id', sucursalId)
  if (estado && estado !== 'todos') query = query.eq('estado', estado)
  if (desde) query = query.gte('fecha', desde)
  if (hasta) query = query.lte('fecha', hasta)
  if (qNumero) {
    query = clienteIds.length > 0
      ? query.or(`numero.ilike.%${qNumero}%,cliente_id.in.(${clienteIds.join(',')})`)
      : query.ilike('numero', `%${qNumero}%`)
  }

  const from = (page - 1) * pageSize
  query = query.range(from, from + pageSize - 1)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total, totalMonto, totalSaldo })
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('optica.ordenes.crear')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const sucursalId = await getHomeSucursalId()
  if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const guardCreate = await assertActiveSucursalIsHome()
  if (guardCreate) return guardCreate

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

  const costo_trabajo  = Math.max(0, parseFloat(body.costo_trabajo ?? '0') || 0)
  const anticipo       = Math.max(0, parseFloat(body.anticipo ?? '0') || 0)
  const descuento_pct  = parseFloat(body.descuento_pct ?? '0') || 0
  const recargo_monto  = Math.max(0, parseFloat(body.recargo_monto ?? '0') || 0)

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
  const total = Math.round((subtotal - descuento_monto + recargo_monto) * 100) / 100

  const { data: nextNum } = await supabase.rpc('next_numero_sucursal', { p_sucursal_id: sucursalId, p_tipo: 'optica_orden' })
  const numero = `OT-${String(sucursalId).padStart(2, '0')}-${String(nextNum).padStart(5, '0')}`

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
      recargo_monto,
      total,
      sucursal_id: sucursalId,
      vendedor_id: body.vendedor_id ?? null,
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

  // Descontar stock de los ítems con articulo_id (armazones del catálogo).
  // Ocurre al crear la OT; después el PUT reconcilia si cambian los ítems.
  // El RPC es transaccional: o descuenta todo o nada.
  const stock = await descontarItemsOptica(orden.id, session.user.id, supabase)
  if (!stock.ok) {
    await supabase.from('optica_ordenes').delete().eq('id', orden.id)
    return NextResponse.json({ error: stock.error }, { status: 400 })
  }

  // Crear pago de seña si se indicó anticipo con método
  const anticipo_metodo: string | undefined = body.anticipo_metodo
  if (anticipo > 0 && anticipo_metodo?.trim()) {
    let cajaSesionId: number | null = null
    if (sucursalId) {
      let { data: caja } = await supabase
        .from('caja_sesiones')
        .select('id')
        .eq('sucursal_id', sucursalId)
        .eq('estado', 'abierta')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!caja) {
        const { data: nueva } = await supabase
          .from('caja_sesiones')
          .insert({ usuario_id: session.user.id, monto_apertura: 0, sucursal_id: sucursalId })
          .select('id')
          .single()
        caja = nueva
      }
      cajaSesionId = caja?.id ?? null
    }
    const fechaPago = body.anticipo_fecha || new Date().toISOString().slice(0, 10)
    await supabase.from('optica_orden_pagos').insert({
      orden_id:       orden.id,
      caja_sesion_id: cajaSesionId,
      metodo:         anticipo_metodo,
      monto:          anticipo,
      concepto:       'SEÑA',
      referencia:     body.anticipo_referencia?.trim() || null,
      fecha_pago:     fechaPago,
      forma_pago_id:  body.anticipo_forma_id ?? null,
      usuario_id:     session.user.id,
    })
    if (anticipo_metodo === 'CUENTA_CORRIENTE' && orden.cliente_id) {
      await supabase.from('cobranzas').insert({
        cliente_id:  orden.cliente_id,
        tipo:        'CARGO',
        monto:       anticipo,
        fecha:       fechaPago,
        descripcion: `${numero} – SEÑA`,
        sucursal_id: sucursalId,
        usuario_id:  session.user.id,
      })
    }
    if (cajaSesionId && anticipo_metodo !== 'CUENTA_CORRIENTE' && anticipo_metodo !== 'NOTA_CREDITO') {
      await supabase.from('caja_movimientos').insert({
        sesion_id:  cajaSesionId,
        tipo:       'ingreso',
        concepto:   `${numero} – SEÑA`,
        monto:      anticipo,
        usuario_id: session.user.id,
      })
    }
  }

  return NextResponse.json({ id: orden.id, numero }, { status: 201 })
}
