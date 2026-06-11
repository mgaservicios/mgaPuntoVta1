import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { assertHomeSucursal } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data, error } = await supabase
    .from('ordenes_venta')
    .select('*, clientes(nombre, telefono), vendedores(nombre), sucursales(nombre, logo_url), orden_venta_items(*), orden_venta_pagos(*)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('ventas.ordenes.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()

  const { data: existing } = await supabase
    .from('ordenes_venta')
    .select('estado, sucursal_id')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const guard = await assertHomeSucursal(existing.sucursal_id)
  if (guard) return guard

  if (existing.estado !== 'borrador') return NextResponse.json({ error: 'Solo se pueden editar órdenes en borrador' }, { status: 400 })

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

  const { error: updateError } = await supabase
    .from('ordenes_venta')
    .update({
      fecha: body.fecha,
      vencimiento: body.vencimiento || null,
      cliente_id: body.cliente_id ?? null,
      condicion_pago: body.condicion_pago ?? 'contado',
      subtotal,
      descuento_pct,
      descuento_monto,
      recargo_monto,
      total,
      observaciones: body.observaciones || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Reemplazar items
  await supabase.from('orden_venta_items').delete().eq('orden_id', id)
  await supabase.from('orden_venta_items').insert(itemsConSubtotal.map(i => ({ ...i, orden_id: Number(id) })))

  // Reemplazar pagos
  await supabase.from('orden_venta_pagos').delete().eq('orden_id', id)
  const pagos = body.pagos ?? []
  if (pagos.length > 0) {
    await supabase.from('orden_venta_pagos').insert(
      pagos.map((p: { metodo: string; monto: number; referencia?: string; fecha_pago?: string; nota_credito_id?: number }) => ({
        orden_id: Number(id),
        metodo: p.metodo,
        monto: p.monto,
        referencia: p.referencia || null,
        fecha_pago: p.fecha_pago || null,
        ...(p.nota_credito_id != null ? { nota_credito_id: p.nota_credito_id } : {}),
      }))
    )
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'Administrador') {
    return NextResponse.json({ error: 'Solo un administrador puede eliminar órdenes de venta' }, { status: 403 })
  }
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data: orden, error: fetchError } = await supabase
    .from('ordenes_venta')
    .select('id, numero, total, fecha, sucursal_id, estado, cliente_id, clientes(nombre)')
    .eq('id', id)
    .single()

  if (fetchError || !orden) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const guardDel = await assertHomeSucursal(orden.sucursal_id)
  if (guardDel) return guardDel

  if (orden.estado !== 'borrador') {
    return NextResponse.json({ error: 'Solo se pueden eliminar órdenes en borrador' }, { status: 409 })
  }

  const { error } = await supabase.from('ordenes_venta').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('eliminaciones_log').insert({
    tipo: 'orden_venta',
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
