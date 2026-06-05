import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

type Ctx = { params: Promise<{ id: string }> }

// terminado ya NO es final: los tipos se pueden seguir editando
const ESTADOS_FINALES = ['entregado', 'anulado']

function derivarEstado(tipos: { estado: string }[]): string {
  if (!tipos.length) return 'pendiente'
  if (tipos.every(t => t.estado === 'terminado')) return 'terminado'
  if (tipos.some(t => t.estado === 'en_proceso')) return 'en_proceso'
  return 'pendiente'
}

export async function GET(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data, error } = await supabase
    .from('optica_servicios')
    .select(`
      *,
      clientes(id, nombre, telefono),
      optica_servicio_tipos(id, tipo, detalle, precio, estado),
      optica_servicio_pagos(id, metodo, monto, concepto, referencia, fecha_pago, created_at)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data: existing, error: fetchError } = await supabase
    .from('optica_servicios')
    .select('estado')
    .eq('id', id)
    .single()

  if (fetchError || !existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (ESTADOS_FINALES.includes(existing.estado)) {
    return NextResponse.json({ error: 'El servicio no puede modificarse en su estado actual' }, { status: 403 })
  }

  const body = await req.json()

  const tipos: { tipo: string; detalle: string | null; precio: number; estado: string }[] = body.tipos ?? []
  const costo_trabajo  = Math.max(0, parseFloat(body.costo_trabajo ?? '0') || 0)
  const anticipo       = Math.max(0, parseFloat(body.anticipo ?? '0') || 0)
  const descuento_pct  = parseFloat(body.descuento_pct ?? '0') || 0

  const subtotal_tipos = tipos.reduce((acc, t) => acc + Math.max(0, t.precio || 0), 0)
  const subtotal       = Math.round((subtotal_tipos + costo_trabajo) * 100) / 100
  const descuento_monto = Math.min(
    Math.max(0, parseFloat(body.descuento_monto ?? '0') || 0),
    subtotal,
  )
  const total = Math.round((subtotal - descuento_monto) * 100) / 100

  const ESTADOS_TRABAJO = ['pendiente', 'en_proceso', 'terminado']
  const tiposNormalizados = tipos.map(t => ({
    ...t,
    estado: ESTADOS_TRABAJO.includes(t.estado) ? t.estado : 'pendiente',
  }))

  // Con tipos → deriva automáticamente; sin tipos → usa body.estado (manual)
  const nuevo_estado = tiposNormalizados.length > 0
    ? derivarEstado(tiposNormalizados)
    : (ESTADOS_TRABAJO.includes(body.estado) ? body.estado : existing.estado)

  const { error: updateError } = await supabase
    .from('optica_servicios')
    .update({
      fecha:           body.fecha,
      fecha_prometida: body.fecha_prometida || null,
      cliente_id:      body.cliente_id ?? null,
      detalle:         body.detalle?.trim() || null,
      observaciones:   body.observaciones?.trim() || null,
      costo_trabajo,
      anticipo,
      descuento_pct,
      descuento_monto,
      subtotal,
      total,
      estado:     nuevo_estado,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await supabase.from('optica_servicio_tipos').delete().eq('servicio_id', id)

  if (tiposNormalizados.length > 0) {
    const { error: tiposError } = await supabase
      .from('optica_servicio_tipos')
      .insert(tiposNormalizados.map(t => ({
        servicio_id: Number(id),
        tipo:    t.tipo,
        detalle: t.detalle?.trim() || null,
        precio:  Math.max(0, t.precio || 0),
        estado:  t.estado,
      })))

    if (tiposError) return NextResponse.json({ error: tiposError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, nuevo_estado })
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'Administrador') {
    return NextResponse.json({ error: 'Solo un administrador puede eliminar servicios' }, { status: 403 })
  }
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data: servicio, error: fetchError } = await supabase
    .from('optica_servicios')
    .select('id, numero, total, fecha, sucursal_id, estado, cliente_id, clientes(nombre), optica_servicio_pagos(id)')
    .eq('id', id)
    .single()

  if (fetchError || !servicio) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const tienePagos = (servicio.optica_servicio_pagos ?? []).length > 0

  if (tienePagos) {
    return NextResponse.json(
      { error: 'Solo se puede eliminar un servicio sin pagos registrados' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('optica_servicios').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('eliminaciones_log').insert({
    tipo:            'optica_servicio',
    referencia_id:   Number(id),
    numero:          servicio.numero,
    cliente_nombre:  (() => { const c = servicio.clientes as unknown; return (Array.isArray(c) ? (c as {nombre:string}[])[0]?.nombre : (c as {nombre:string}|null)?.nombre) ?? null })(),
    total:           servicio.total,
    fecha_documento: servicio.fecha,
    sucursal_id:     servicio.sucursal_id,
    estado_previo:   servicio.estado,
    usuario_id:      session.user.id,
    datos_extra:     { cliente_id: servicio.cliente_id },
  })

  return NextResponse.json({ ok: true })
}
