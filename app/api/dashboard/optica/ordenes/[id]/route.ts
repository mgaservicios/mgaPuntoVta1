import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { assertHomeSucursal } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

const ESTADOS_FINALES = ['terminado', 'entregado', 'anulado']

export async function GET(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data, error } = await supabase
    .from('optica_ordenes')
    .select(`
      *,
      clientes(nombre, telefono),
      optica_medicos(nombre, matricula),
      optica_orden_items(id, tipo, uso, nombre, armazon_propio, articulo_id, variante_id, cantidad, precio_unitario, descuento_pct, subtotal, notas),
      optica_orden_tareas(id, titulo, descripcion, estado, fecha, fecha_fin, laboratorio_nombre, laboratorio_tipo, created_at, updated_at, users!usuario_id(name, email)),
      optica_orden_pagos(id, metodo, monto, concepto, referencia, fecha_pago, created_at)
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  // Verificar estado y tareas actuales
  const { data: existing, error: fetchError } = await supabase
    .from('optica_ordenes')
    .select('estado, sucursal_id, optica_orden_tareas(id), optica_orden_pagos(id)')
    .eq('id', id)
    .single()

  if (fetchError || !existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const guard = await assertHomeSucursal(existing.sucursal_id)
  if (guard) return guard

  if (ESTADOS_FINALES.includes(existing.estado)) {
    return NextResponse.json({ error: 'La orden no puede modificarse en su estado actual' }, { status: 403 })
  }

  const body = await req.json()
  const tieneTareas = (existing.optica_orden_tareas ?? []).length > 0

  // Con tareas en curso: solo se puede actualizar la fecha prometida
  if (tieneTareas) {
    const { error: updateError } = await supabase
      .from('optica_ordenes')
      .update({
        fecha_prometida: body.fecha_prometida || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    return NextResponse.json({ ok: true, solo_fecha_prometida: true })
  }

  // Edición completa (sin tareas)
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

  const items_subtotal = itemsConSubtotal.reduce((acc, i) => acc + i.subtotal, 0)
  const subtotal       = Math.round((items_subtotal + costo_trabajo) * 100) / 100
  const descuento_monto = Math.min(
    Math.max(0, parseFloat(body.descuento_monto ?? '0') || 0),
    subtotal,
  )
  const total = Math.round((subtotal - descuento_monto) * 100) / 100

  const { error: updateError } = await supabase
    .from('optica_ordenes')
    .update({
      fecha: body.fecha,
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
      descuento_pct,
      descuento_monto,
      subtotal,
      total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await supabase.from('optica_orden_items').delete().eq('orden_id', id)

  if (itemsConSubtotal.length > 0) {
    const { error: itemsError } = await supabase
      .from('optica_orden_items')
      .insert(itemsConSubtotal.map(i => ({ ...i, orden_id: Number(id) })))

    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'Administrador') {
    return NextResponse.json({ error: 'Solo un administrador puede eliminar órdenes de trabajo' }, { status: 403 })
  }
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data: orden, error: fetchError } = await supabase
    .from('optica_ordenes')
    .select('id, numero, total, fecha, sucursal_id, estado, cliente_id, clientes(nombre), optica_orden_tareas(id), optica_orden_pagos(id)')
    .eq('id', id)
    .single()

  if (fetchError || !orden) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const guardDel = await assertHomeSucursal(orden.sucursal_id)
  if (guardDel) return guardDel

  const tieneTareas = (orden.optica_orden_tareas ?? []).length > 0
  const tienePagos  = (orden.optica_orden_pagos ?? []).length > 0

  if (tieneTareas || tienePagos) {
    return NextResponse.json(
      { error: 'Solo se puede eliminar una OT sin tareas ni pagos registrados' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('optica_ordenes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('eliminaciones_log').insert({
    tipo: 'optica_ot',
    referencia_id: Number(id),
    numero: orden.numero,
    cliente_nombre: (() => { const c = orden.clientes as unknown; return (Array.isArray(c) ? (c as {nombre:string}[])[0]?.nombre : (c as {nombre:string}|null)?.nombre) ?? null })(),
    total: orden.total,
    fecha_documento: orden.fecha,
    sucursal_id: orden.sucursal_id,
    estado_previo: orden.estado,
    usuario_id: session.user.id,
    datos_extra: { cliente_id: orden.cliente_id },
  })

  return NextResponse.json({ ok: true })
}
