import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { getHomeSucursalId, assertHomeSucursal } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('ventas.ordenes.confirmar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()

  const monto = parseFloat(body.monto ?? '0')
  if (isNaN(monto) || monto <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
  const metodo: string = body.metodo?.trim()
  if (!metodo) return NextResponse.json({ error: 'Método requerido' }, { status: 400 })

  const { data: orden } = await supabase
    .from('ordenes_venta')
    .select('numero, cliente_id, sucursal_id, recargo_monto, total')
    .eq('id', id)
    .single()

  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

  const guard = await assertHomeSucursal(orden.sucursal_id)
  if (guard) return guard

  const sucursalId = await getHomeSucursalId()
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

  const { data: pago, error } = await supabase
    .from('orden_venta_pagos')
    .insert({
      orden_id:     Number(id),
      metodo:       metodo,
      monto,
      referencia:   body.referencia?.trim() || null,
      fecha_pago:   body.fecha_pago || new Date().toISOString().slice(0, 10),
      forma_pago_id: body.forma_pago_id ?? null,
      cuotas:       body.cuotas ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Actualizar recargo en la OV si se indicó
  const recargo_monto = Math.max(0, parseFloat(body.recargo_monto ?? '0') || 0)
  if (recargo_monto > 0) {
    const oldRecargo = Number(orden.recargo_monto ?? 0)
    const newTotal = Math.round((Number(orden.total) - oldRecargo + recargo_monto) * 100) / 100
    await supabase.from('ordenes_venta').update({ recargo_monto, total: newTotal }).eq('id', id)
  }

  // Registrar deuda en cuenta corriente
  if (metodo === 'CUENTA_CORRIENTE' && orden.cliente_id) {
    await supabase.from('cobranzas').insert({
      cliente_id: orden.cliente_id,
      tipo: 'CARGO',
      monto,
      fecha: body.fecha_pago || new Date().toISOString().slice(0, 10),
      descripcion: `Orden de venta ${orden.numero}`,
      orden_id: Number(id),
      sucursal_id: orden.sucursal_id,
      usuario_id: session.user.id,
    })
  }

  if (cajaSesionId && metodo !== 'CUENTA_CORRIENTE' && metodo !== 'NOTA_CREDITO') {
    await supabase.from('caja_movimientos').insert({
      sesion_id: cajaSesionId,
      tipo: 'ingreso',
      concepto: `${orden.numero} – ${metodo}`,
      monto,
      usuario_id: session.user.id,
    })
  }

  return NextResponse.json(pago, { status: 201 })
}
