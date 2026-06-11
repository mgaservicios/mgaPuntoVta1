import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { adjustArticuloStock, syncArticuloStock, validarStockSuficiente } from '@/services/stock'
import { getActiveSucursalId, getHomeSucursalId, getSucursalFilter, assertActiveSucursalIsHome } from '@/lib/sucursal'

// GET — historial de ventas
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

  let q = supabase
    .from('ventas')
    .select('id, numero, fecha, estado, subtotal, descuento_pct, descuento_monto, total, sucursal_id, cliente_id, clientes(nombre), vendedores(nombre)')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(verTodas ? 500 : 200)

  if (!verTodas && sucursalId) q = q.eq('sucursal_id', sucursalId)
  if (estado && estado !== 'todos') q = q.eq('estado', estado)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!verTodas) return NextResponse.json(data ?? [])

  // Enrich with sucursal name when showing all
  const sucIds = [...new Set((data ?? []).map(v => v.sucursal_id).filter(Boolean))]
  const { data: sucs } = sucIds.length
    ? await supabase.from('sucursales').select('id, nombre').in('id', sucIds)
    : { data: [] as { id: number; nombre: string }[] }
  const sucMap = Object.fromEntries((sucs ?? []).map(s => [s.id, s.nombre]))
  return NextResponse.json((data ?? []).map(v => ({ ...v, nombre_sucursal: sucMap[v.sucursal_id] ?? null })))
}

// POST — registrar nueva venta
export async function POST(req: NextRequest) {
  const session = await requirePermission('ventas.pos.cobrar')
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
    cantidad: number
    precio_unitario: number
    descuento_pct: number
  }[] = body.items ?? []

  const pagos: { metodo: string; monto: number; referencia?: string; nota_credito_id?: number; forma_pago_id?: number; cuotas?: number; fecha_pago?: string }[] = body.pagos ?? []

  if (items.length === 0) return NextResponse.json({ error: 'La venta no tiene ítems' }, { status: 400 })
  if (pagos.length === 0) return NextResponse.json({ error: 'La venta no tiene pagos' }, { status: 400 })

  // Validar notas de crédito antes de procesar
  const pagosNC = pagos.filter(p => p.metodo === 'NOTA_CREDITO')
  for (const p of pagosNC) {
    if (!p.nota_credito_id) return NextResponse.json({ error: 'Pago con nota de crédito sin id' }, { status: 400 })
    const { data: nc } = await supabase
      .from('notas_credito').select('monto_disponible, estado, cliente_id').eq('id', p.nota_credito_id).single()
    if (!nc || nc.estado === 'anulada') return NextResponse.json({ error: `Nota de crédito ${p.nota_credito_id} no válida` }, { status: 400 })
    if (Number(nc.monto_disponible) < p.monto - 0.001) return NextResponse.json({ error: `Saldo insuficiente en nota de crédito (disponible: ${nc.monto_disponible})` }, { status: 400 })
  }

  // Caja abierta — si no existe, se abre automáticamente para la sucursal activa
  let { data: cajaSesion } = await supabase
    .from('caja_sesiones')
    .select('id')
    .eq('estado', 'abierta')
    .eq('sucursal_id', sucursalId)
    .maybeSingle()

  if (!cajaSesion) {
    const { data: nueva, error: cajaError } = await supabase
      .from('caja_sesiones')
      .insert({ usuario_id: session.user.id, monto_apertura: 0, sucursal_id: sucursalId })
      .select('id')
      .single()
    if (cajaError) return NextResponse.json({ error: `No se pudo abrir la caja: ${cajaError.message}` }, { status: 500 })
    cajaSesion = nueva
  }

  if (!cajaSesion) return NextResponse.json({ error: 'No se pudo abrir la caja' }, { status: 500 })

  // Totales
  const descuento_pct = parseFloat(body.descuento_pct ?? '0') || 0
  const recargo_monto = Math.max(0, parseFloat(body.recargo_monto ?? '0') || 0)
  const subtotal = items.reduce((acc, item) => {
    const lineSubtotal = item.cantidad * item.precio_unitario * (1 - (item.descuento_pct ?? 0) / 100)
    return acc + lineSubtotal
  }, 0)
  const descuento_monto = Math.round(subtotal * (descuento_pct / 100) * 100) / 100
  const total = Math.round((subtotal - descuento_monto + recargo_monto) * 100) / 100

  const totalPagado = pagos.reduce((acc, p) => acc + p.monto, 0)
  if (Math.round(totalPagado * 100) < Math.round(total * 100))
    return NextResponse.json({ error: 'El total pagado es menor al total de la venta' }, { status: 400 })

  // Número de venta
  const { count } = await supabase.from('ventas').select('id', { count: 'exact', head: true })
  const numero = `V-${String((count ?? 0) + 1).padStart(5, '0')}`

  // Nombres de artículos y variantes (snapshot)
  const articuloIds = [...new Set(items.map(i => i.articulo_id))]
  const { data: articulos } = await supabase
    .from('articulos')
    .select('id, nombre')
    .in('id', articuloIds)

  const varianteIds = items.map(i => i.variante_id).filter((v): v is number => v !== null)
  let variantesMap: Record<number, string> = {}
  if (varianteIds.length > 0) {
    const { data: variantes } = await supabase
      .from('articulo_variantes')
      .select('id, variante_atributos(valor, atributo_tipos(nombre))')
      .in('id', varianteIds)
    if (variantes) {
      for (const v of variantes) {
        const attrs = (v.variante_atributos ?? []) as unknown as { valor: string; atributo_tipos?: { nombre: string } | null }[]
        variantesMap[v.id] = attrs.map(a => `${a.atributo_tipos?.nombre ?? ''}: ${a.valor}`).join(' / ')
      }
    }
  }

  const articulosMap = Object.fromEntries((articulos ?? []).map(a => [a.id, a.nombre]))

  // Insertar venta
  const { data: venta, error: ventaError } = await supabase
    .from('ventas')
    .insert({
      numero,
      fecha: body.fecha ?? new Date().toISOString().slice(0, 10),
      cliente_id: body.cliente_id ?? null,
      vendedor_id: body.vendedor_id ?? null,
      caja_sesion_id: cajaSesion.id,
      sucursal_id: sucursalId,
      subtotal,
      descuento_pct,
      descuento_monto,
      recargo_monto,
      total,
      observaciones: body.observaciones || null,
    })
    .select()
    .single()

  if (ventaError) return NextResponse.json({ error: ventaError.message }, { status: 500 })

  // Insertar items
  const itemsPayload = items.map(item => {
    const lineSubtotal = item.cantidad * item.precio_unitario * (1 - (item.descuento_pct ?? 0) / 100)
    return {
      venta_id: venta.id,
      articulo_id: item.articulo_id,
      variante_id: item.variante_id ?? null,
      nombre_articulo: articulosMap[item.articulo_id] ?? `#${item.articulo_id}`,
      descripcion_variante: item.variante_id ? (variantesMap[item.variante_id] ?? null) : null,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      descuento_pct: item.descuento_pct ?? 0,
      subtotal: Math.round(lineSubtotal * 100) / 100,
    }
  })

  const { data: insertedItems, error: itemsError } = await supabase
    .from('venta_items')
    .insert(itemsPayload)
    .select()

  if (itemsError) {
    await supabase.from('ventas').delete().eq('id', venta.id)
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Insertar pagos + CARGO CC de forma atómica
  const { error: pagosError } = await supabase.rpc('registrar_pagos_venta', {
    p_venta_id:    venta.id,
    p_cliente_id:  body.cliente_id ?? null,
    p_fecha:       body.fecha ?? new Date().toISOString().slice(0, 10),
    p_numero:      numero,
    p_sucursal_id: sucursalId,
    p_usuario_id:  session.user.id,
    p_pagos:       pagos.map(p => ({
      metodo:          p.metodo,
      monto:           p.monto,
      referencia:      p.referencia || null,
      nota_credito_id: p.nota_credito_id ?? null,
      forma_pago_id:   p.forma_pago_id ?? null,
      cuotas:          p.cuotas ?? null,
      fecha_pago:      p.fecha_pago || null,
    })),
  })
  if (pagosError) {
    await supabase.from('ventas').delete().eq('id', venta.id)
    return NextResponse.json({ error: pagosError.message }, { status: 500 })
  }

  // Validar stock antes de descontar (solo si la sucursal controla stock)
  const stockValidErr = await validarStockSuficiente(
    items.filter(i => i.cantidad > 0).map(i => ({ articulo_id: i.articulo_id, variante_id: i.variante_id ?? null, cantidad: i.cantidad })),
    sucursalId,
    supabase,
  )
  if (stockValidErr) {
    await supabase.from('ventas').delete().eq('id', venta.id)
    return NextResponse.json({ error: stockValidErr }, { status: 400 })
  }

  // Actualizar stock por sucursal + movimientos
  const articuloIdsSet = new Set<number>()
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const insertedItem = insertedItems![i]

    // Read current stock before adjustment to log correct before/after values
    const vid = item.variante_id ?? null
    let stockQ = supabase
      .from('articulo_stock')
      .select('stock_actual')
      .eq('articulo_id', item.articulo_id)
      .eq('sucursal_id', sucursalId)
    stockQ = vid === null ? stockQ.is('variante_id', null) : stockQ.eq('variante_id', vid)
    const { data: stockRow } = await stockQ.maybeSingle()
    const stockAntes = Number(stockRow?.stock_actual ?? 0)

    // delta = -cantidad (salida). Cantidad negativa (devolución) → delta positivo → suma stock
    const stockErr = await adjustArticuloStock(item.articulo_id, vid, sucursalId, -item.cantidad, supabase)
    if (stockErr) {
      await supabase.from('ventas').delete().eq('id', venta.id)
      return NextResponse.json({ error: `Error ajustando stock artículo ${item.articulo_id}: ${stockErr}` }, { status: 500 })
    }
    articuloIdsSet.add(item.articulo_id)

    await supabase.from('movimientos_stock').insert({
      articulo_id: item.articulo_id,
      variante_id: vid,
      sucursal_id: sucursalId,
      tipo: 'venta',
      cantidad: item.cantidad,
      stock_antes: stockAntes,
      stock_despues: stockAntes - item.cantidad,
      venta_id: venta.id,
      venta_item_id: insertedItem.id,
      usuario_id: session.user.id,
    })
  }

  for (const aid of articuloIdsSet) await syncArticuloStock(aid, supabase)

  // Descontar saldo de notas de crédito utilizadas
  for (const p of pagosNC) {
    const { data: nc } = await supabase
      .from('notas_credito').select('monto_disponible').eq('id', p.nota_credito_id!).single()
    if (nc) {
      const nuevo = Math.max(0, Number(nc.monto_disponible) - p.monto)
      await supabase.from('notas_credito').update({
        monto_disponible: nuevo,
        estado: nuevo <= 0 ? 'utilizada' : 'pendiente',
        updated_at: new Date().toISOString(),
      }).eq('id', p.nota_credito_id!)
    }
  }

  // Movimientos de caja para métodos que no son cuenta corriente
  const METODO_LABELS: Record<string, string> = {
    EFECTIVO: 'Efectivo',
    TRANSFERENCIA: 'Transferencia',
    TARJETA_DEBITO: 'Tarjeta débito',
    TARJETA_CREDITO: 'Tarjeta crédito',
    CHEQUE: 'Cheque',
    OTRO: 'Otro',
  }
  const pagosNoCc = pagos.filter(p => p.metodo !== 'CUENTA_CORRIENTE' && p.metodo !== 'NOTA_CREDITO')
  for (const p of pagosNoCc) {
    await supabase.from('caja_movimientos').insert({
      sesion_id: cajaSesion.id,
      tipo: 'ingreso',
      concepto: `Venta ${numero} - ${METODO_LABELS[p.metodo] ?? p.metodo}`,
      monto: p.monto,
      usuario_id: session.user.id,
    })
  }

  return NextResponse.json({ id: venta.id, numero }, { status: 201 })
}
