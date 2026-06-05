import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getActiveSucursalId } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()

  const monto = parseFloat(body.monto ?? '0')
  if (isNaN(monto) || monto <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })

  const metodo = body.metodo
  const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CUENTA_CORRIENTE', 'CHEQUE', 'OTRO']
  if (!METODOS.includes(metodo)) return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 })

  const concepto: string = body.concepto?.trim() || 'PAGO'

  const METODO_LABELS: Record<string, string> = {
    EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia',
    TARJETA_DEBITO: 'Tarjeta débito', TARJETA_CREDITO: 'Tarjeta crédito',
    CUENTA_CORRIENTE: 'Cuenta corriente', CHEQUE: 'Cheque', OTRO: 'Otro',
  }

  // Obtener número de orden para concepto en caja
  const { data: orden } = await supabase
    .from('optica_ordenes')
    .select('numero')
    .eq('id', id)
    .single()

  if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

  // Buscar o crear sesión de caja activa en la sucursal
  const sucursalId = await getActiveSucursalId()
  if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  let { data: cajaSesion } = await supabase
    .from('caja_sesiones')
    .select('id')
    .eq('sucursal_id', sucursalId)
    .eq('estado', 'abierta')
    .order('created_at', { ascending: false })
    .limit(1)
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

  // Registrar pago
  const { data: pago, error: pagoError } = await supabase
    .from('optica_orden_pagos')
    .insert({
      orden_id: Number(id),
      caja_sesion_id: cajaSesion!.id,
      metodo,
      monto,
      concepto,
      referencia: body.referencia?.trim() || null,
      fecha_pago: body.fecha_pago || new Date().toISOString().slice(0, 10),
      usuario_id: session.user.id,
    })
    .select()
    .single()

  if (pagoError) return NextResponse.json({ error: pagoError.message }, { status: 500 })

  // Registrar en caja (solo métodos que no sean cuenta corriente)
  if (metodo !== 'CUENTA_CORRIENTE') {
    await supabase.from('caja_movimientos').insert({
      sesion_id: cajaSesion!.id,
      tipo: 'ingreso',
      concepto: concepto === 'PAGO'
        ? `OT ${orden.numero} – ${METODO_LABELS[metodo] ?? metodo}`
        : `OT ${orden.numero} – ${concepto} · ${METODO_LABELS[metodo] ?? metodo}`,
      monto,
      usuario_id: session.user.id,
    })
  }

  return NextResponse.json(pago, { status: 201 })
}
