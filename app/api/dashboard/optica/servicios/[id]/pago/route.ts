import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getHomeSucursalId, assertHomeSucursal } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()

  const monto = parseFloat(body.monto ?? '0')
  if (isNaN(monto) || monto <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })

  const metodo: string = body.metodo?.trim()
  if (!metodo) return NextResponse.json({ error: 'Método de pago requerido' }, { status: 400 })

  const concepto: string = body.concepto?.trim() || 'PAGO'
  const today = new Date().toISOString().slice(0, 10)

  // Validar NC si corresponde
  if (metodo === 'NOTA_CREDITO') {
    const ncId = body.nota_credito_id
    if (!ncId) return NextResponse.json({ error: 'Nota de crédito requerida' }, { status: 400 })
    const { data: nc } = await supabase
      .from('notas_credito').select('monto_disponible, estado').eq('id', ncId).single()
    if (!nc || nc.estado === 'anulada') return NextResponse.json({ error: 'Nota de crédito no válida' }, { status: 400 })
    if (Number(nc.monto_disponible) < monto - 0.001) return NextResponse.json({ error: `Saldo insuficiente en NC (disponible: ${nc.monto_disponible})` }, { status: 400 })
  }

  const { data: servicio } = await supabase
    .from('optica_servicios')
    .select('numero, cliente_id, sucursal_id')
    .eq('id', id)
    .single()

  if (!servicio) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

  const guard = await assertHomeSucursal(servicio.sucursal_id)
  if (guard) return guard

  const sucursalId = await getHomeSucursalId()
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

  if (!cajaSesion) return NextResponse.json({ error: 'No hay sesión de caja activa' }, { status: 500 })

  // Registrar pago + CARGO CC de forma atómica
  const { data: pago, error: pagoError } = await supabase.rpc('registrar_pago_optica_servicio', {
    p_servicio_id:    Number(id),
    p_caja_sesion_id: cajaSesion.id,
    p_metodo:         metodo,
    p_monto:          monto,
    p_concepto:       concepto,
    p_referencia:     body.referencia?.trim() || '',
    p_fecha_pago:     body.fecha_pago || today,
    p_usuario_id:     session.user.id,
    p_cliente_id:     servicio.cliente_id ?? null,
    p_sucursal_id:    servicio.sucursal_id,
    p_numero:         servicio.numero,
    p_forma_pago_id:  body.forma_pago_id ?? null,
    p_cuotas:         body.cuotas ?? null,
    p_recargo_monto:  body.recargo_monto ?? 0,
  })

  if (pagoError) return NextResponse.json({ error: pagoError.message }, { status: 500 })

  // Descontar saldo de NC si corresponde
  if (metodo === 'NOTA_CREDITO' && body.nota_credito_id) {
    const { data: nc } = await supabase
      .from('notas_credito').select('monto_disponible').eq('id', body.nota_credito_id).single()
    if (nc) {
      const nuevo = Math.max(0, Number(nc.monto_disponible) - monto)
      await supabase.from('notas_credito').update({
        monto_disponible: nuevo,
        estado: nuevo <= 0 ? 'utilizada' : 'pendiente',
        updated_at: new Date().toISOString(),
      }).eq('id', body.nota_credito_id)
    }
  }

  // Movimiento de caja (no para CC ni NC)
  if (metodo !== 'CUENTA_CORRIENTE' && metodo !== 'NOTA_CREDITO') {
    await supabase.from('caja_movimientos').insert({
      sesion_id:  cajaSesion.id,
      tipo:       'ingreso',
      concepto: `SV ${servicio.numero} – ${concepto !== 'PAGO' ? concepto + ' · ' : ''}${metodo}`,
      monto,
      usuario_id: session.user.id,
    })
  }

  return NextResponse.json(pago, { status: 201 })
}
