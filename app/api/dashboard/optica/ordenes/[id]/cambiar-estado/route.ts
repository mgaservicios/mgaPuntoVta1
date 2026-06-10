import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getHomeSucursalId, assertHomeSucursal } from '@/lib/sucursal'

const ESTADOS_MANUALES = ['terminado', 'entregado', 'anulado'] as const

const TRANSICIONES: Record<string, string[]> = {
  pendiente:      ['terminado', 'entregado', 'anulado'],
  en_proceso:     ['terminado', 'entregado', 'anulado'],
  en_laboratorio: ['terminado', 'entregado', 'anulado'],
  terminado:      ['entregado', 'anulado'],
}

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()
  const nuevo_estado = body.estado

  if (!ESTADOS_MANUALES.includes(nuevo_estado)) {
    return NextResponse.json({ error: 'Solo se puede establecer manualmente: terminado, entregado o anulado' }, { status: 400 })
  }

  const { data: actual, error: fetchErr } = await supabase
    .from('optica_ordenes')
    .select('id, estado, sucursal_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !actual) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })

  const guard = await assertHomeSucursal(actual.sucursal_id)
  if (guard) return guard

  const transicionesValidas = TRANSICIONES[actual.estado] ?? []
  if (!transicionesValidas.includes(nuevo_estado)) {
    return NextResponse.json(
      { error: `No se puede cambiar de "${actual.estado}" a "${nuevo_estado}"` },
      { status: 403 },
    )
  }

  const { error } = await supabase
    .from('optica_ordenes')
    .update({ estado: nuevo_estado, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Al terminar: marcar todas las tareas como terminada
  if (nuevo_estado === 'terminado') {
    await supabase
      .from('optica_orden_tareas')
      .update({ estado: 'terminada', updated_at: new Date().toISOString() })
      .eq('orden_id', id)
  }

  // Al anular: generar pago negativo para balancear el saldo pendiente
  if (nuevo_estado === 'anulado') {
    const { data: orden } = await supabase
      .from('optica_ordenes')
      .select('numero, total, cliente_id, optica_orden_pagos(metodo, monto)')
      .eq('id', id)
      .single()

    if (orden) {
      const sucursalId = await getHomeSucursalId()
      if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

      const pagos = orden.optica_orden_pagos ?? []
      const pagado = pagos.reduce((a: number, p: { monto: number }) => a + Number(p.monto), 0)
      const saldo  = Math.round((orden.total - pagado) * 100) / 100

      if (saldo > 0.005) {

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
        if (!caja) return NextResponse.json({ error: 'No se pudo crear sesión de caja' }, { status: 500 })

        await supabase.from('optica_orden_pagos').insert({
          orden_id: Number(id),
          caja_sesion_id: caja.id,
          metodo: 'OTRO',
          monto: -saldo,
          concepto: `ANULACION OT ${orden.numero}`,
          fecha_pago: new Date().toISOString().slice(0, 10),
          usuario_id: session.user.id,
        })

        await supabase.from('caja_movimientos').insert({
          sesion_id: caja.id,
          tipo: 'egreso',
          concepto: `Anulación OT ${orden.numero} - OTRO`,
          monto: saldo,
          usuario_id: session.user.id,
        })
      }

      // Reversar CARGOs en cuenta corriente generados por pagos CC
      const sumCC = pagos
        .filter((p: { metodo: string }) => p.metodo === 'CUENTA_CORRIENTE')
        .reduce((a: number, p: { monto: number }) => a + Number(p.monto), 0)

      if (sumCC > 0.005 && orden.cliente_id) {
        await supabase.from('cobranzas').insert({
          cliente_id: orden.cliente_id,
          tipo: 'PAGO',
          monto: sumCC,
          fecha: new Date().toISOString().slice(0, 10),
          descripcion: `Anulación OT ${orden.numero}`,
          optica_orden_id: Number(id),
          sucursal_id: sucursalId,
          usuario_id: session.user.id,
        })
      }
    }
  }

  return NextResponse.json({ estado: nuevo_estado })
}
