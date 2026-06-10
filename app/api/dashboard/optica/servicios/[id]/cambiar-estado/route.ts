import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getHomeSucursalId, assertHomeSucursal } from '@/lib/sucursal'

const ESTADOS_MANUALES = ['terminado', 'entregado', 'anulado'] as const

const TRANSICIONES: Record<string, string[]> = {
  pendiente:  ['terminado', 'entregado', 'anulado'],
  en_proceso: ['terminado', 'entregado', 'anulado'],
  terminado:  ['entregado', 'anulado'],
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
    .from('optica_servicios')
    .select('id, estado, sucursal_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !actual) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

  const guard = await assertHomeSucursal(actual.sucursal_id)
  if (guard) return guard

  const transicionesValidas = TRANSICIONES[actual.estado] ?? []
  if (!transicionesValidas.includes(nuevo_estado)) {
    return NextResponse.json(
      { error: `No se puede cambiar de "${actual.estado}" a "${nuevo_estado}"` },
      { status: 403 },
    )
  }

  const { data: updated, error } = await supabase
    .from('optica_servicios')
    .update({ estado: nuevo_estado, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

  if (nuevo_estado === 'terminado') {
    await supabase
      .from('optica_servicio_tipos')
      .update({ estado: 'terminado' })
      .eq('servicio_id', id)
  }

  if (nuevo_estado === 'anulado') {
    const { data: servicio } = await supabase
      .from('optica_servicios')
      .select('numero, total, cliente_id, optica_servicio_pagos(metodo, monto)')
      .eq('id', id)
      .single()

    if (servicio) {
      const pagos = servicio.optica_servicio_pagos ?? []
      const pagado = pagos.reduce((a: number, p: { monto: number }) => a + Number(p.monto), 0)
      const saldo = Math.round((servicio.total - pagado) * 100) / 100

      if (saldo > 0.005) {
        const sucursalId = await getHomeSucursalId()
        if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

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

        await supabase.from('optica_servicio_pagos').insert({
          servicio_id:    Number(id),
          caja_sesion_id: caja.id,
          metodo:         'OTRO',
          monto:          -saldo,
          concepto:       `ANULACION SV ${servicio.numero}`,
          fecha_pago:     new Date().toISOString().slice(0, 10),
          usuario_id:     session.user.id,
        })

        await supabase.from('caja_movimientos').insert({
          sesion_id:  caja.id,
          tipo:       'egreso',
          concepto:   `Anulación SV ${servicio.numero} - OTRO`,
          monto:      saldo,
          usuario_id: session.user.id,
        })
      }

      // Reversar CARGOs en cuenta corriente generados por pagos CC
      const sumCC = pagos
        .filter((p: { metodo: string }) => p.metodo === 'CUENTA_CORRIENTE')
        .reduce((a: number, p: { monto: number }) => a + Number(p.monto), 0)

      if (sumCC > 0.005 && servicio.cliente_id) {
        await supabase.from('cobranzas').insert({
          cliente_id: servicio.cliente_id,
          tipo: 'PAGO',
          monto: sumCC,
          fecha: new Date().toISOString().slice(0, 10),
          descripcion: `Anulación SV ${servicio.numero}`,
          optica_servicio_id: Number(id),
          sucursal_id: sucursalId,
          usuario_id: session.user.id,
        })
      }
    }
  }

  return NextResponse.json({ estado: nuevo_estado })
}
