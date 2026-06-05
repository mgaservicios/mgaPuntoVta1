import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getActiveSucursalId } from '@/lib/sucursal'

const ESTADOS_MANUALES = ['entregado', 'anulado'] as const

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()
  const nuevo_estado = body.estado

  if (!ESTADOS_MANUALES.includes(nuevo_estado)) {
    return NextResponse.json({ error: 'Solo se puede establecer manualmente: entregado o anulado' }, { status: 400 })
  }

  const { error } = await supabase
    .from('optica_servicios')
    .update({ estado: nuevo_estado, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (nuevo_estado === 'anulado') {
    const { data: servicio } = await supabase
      .from('optica_servicios')
      .select('numero, total, optica_servicio_pagos(monto)')
      .eq('id', id)
      .single()

    if (servicio) {
      const pagado = (servicio.optica_servicio_pagos ?? []).reduce(
        (a: number, p: { monto: number }) => a + p.monto, 0
      )
      const saldo = Math.round((servicio.total - pagado) * 100) / 100

      if (saldo > 0.005) {
        const sucursalId = await getActiveSucursalId()
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
    }
  }

  return NextResponse.json({ estado: nuevo_estado })
}
