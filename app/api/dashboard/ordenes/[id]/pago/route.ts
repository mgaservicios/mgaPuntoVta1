import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getActiveSucursalId } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

const METODOS_VALIDOS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CUENTA_CORRIENTE', 'NOTA_CREDITO', 'CHEQUE', 'OTRO']

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()

  const monto = parseFloat(body.monto ?? '0')
  if (isNaN(monto) || monto <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
  if (!METODOS_VALIDOS.includes(body.metodo)) return NextResponse.json({ error: 'Método inválido' }, { status: 400 })

  const { data: orden } = await supabase
    .from('ordenes_venta')
    .select('numero')
    .eq('id', id)
    .single()

  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

  const sucursalId = await getActiveSucursalId()
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

  const { data: pago, error } = await supabase
    .from('orden_venta_pagos')
    .insert({
      orden_id: Number(id),
      metodo: body.metodo,
      monto,
      referencia: body.referencia?.trim() || null,
      fecha_pago: body.fecha_pago || new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (cajaSesionId) {
    await supabase.from('caja_movimientos').insert({
      sesion_id: cajaSesionId,
      tipo: 'ingreso',
      concepto: `${orden.numero} – pago`,
      monto,
      usuario_id: session.user.id,
    })
  }

  return NextResponse.json(pago, { status: 201 })
}
