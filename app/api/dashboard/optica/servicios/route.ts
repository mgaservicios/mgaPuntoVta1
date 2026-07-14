import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { getHomeSucursalId, getSucursalFilter, assertActiveSucursalIsHome } from '@/lib/sucursal'

function derivarEstado(tipos: { estado: string }[]): string {
  if (!tipos.length) return 'pendiente'
  if (tipos.every(t => t.estado === 'terminado')) return 'terminado'
  if (tipos.some(t => t.estado === 'en_proceso')) return 'en_proceso'
  return 'pendiente'
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')
  const desde  = searchParams.get('desde')
  const hasta  = searchParams.get('hasta')
  const q      = searchParams.get('q')

  const { sucursalId, verTodas } = await getSucursalFilter()

  let query = supabase
    .from('optica_servicios')
    .select(`
      id, numero, fecha, fecha_prometida, estado, total,
      cliente_id, clientes(nombre),
      optica_servicio_pagos(monto),
      optica_servicio_tipos(tipo)
    `)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (!verTodas && sucursalId) query = query.eq('sucursal_id', sucursalId)
  if (estado && estado !== 'todos') query = query.eq('estado', estado)
  if (desde) query = query.gte('fecha', desde)
  if (hasta) query = query.lte('fecha', hasta)
  if (q) {
    const { data: clientesMatch } = await supabase
      .from('clientes')
      .select('id')
      .ilike('nombre', `%${q}%`)
      .limit(200)
    const clienteIds = (clientesMatch ?? []).map((c: { id: number }) => c.id)
    if (clienteIds.length > 0) {
      query = query.or(`numero.ilike.%${q}%,cliente_id.in.(${clienteIds.join(',')})`)
    } else {
      query = query.ilike('numero', `%${q}%`)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('optica.servicios.crear')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const sucursalId = await getHomeSucursalId()
  if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const guardCreate = await assertActiveSucursalIsHome()
  if (guardCreate) return guardCreate

  const body = await req.json()

  const tipos: { tipo: string; detalle: string | null; precio: number; estado?: string }[] = body.tipos ?? []
  const ESTADOS_TRABAJO = ['pendiente', 'en_proceso', 'terminado']

  const costo_trabajo  = Math.max(0, parseFloat(body.costo_trabajo ?? '0') || 0)
  const anticipo       = Math.max(0, parseFloat(body.anticipo ?? '0') || 0)
  const descuento_pct  = parseFloat(body.descuento_pct ?? '0') || 0
  const recargo_monto  = Math.max(0, parseFloat(body.recargo_monto ?? '0') || 0)

  const subtotal_tipos = tipos.reduce((acc, t) => acc + Math.max(0, t.precio || 0), 0)
  const subtotal       = Math.round((subtotal_tipos + costo_trabajo) * 100) / 100
  const descuento_monto = Math.min(
    Math.max(0, parseFloat(body.descuento_monto ?? '0') || 0),
    subtotal,
  )
  const total = Math.round((subtotal - descuento_monto + recargo_monto) * 100) / 100

  const { data: nextNum } = await supabase.rpc('next_numero_sucursal', { p_sucursal_id: sucursalId, p_tipo: 'optica_servicio' })
  const numero = `SV-${String(sucursalId).padStart(2, '0')}-${String(nextNum).padStart(5, '0')}`

  const { data: servicio, error: servicioError } = await supabase
    .from('optica_servicios')
    .insert({
      numero,
      fecha:           body.fecha ?? new Date().toISOString().slice(0, 10),
      fecha_prometida: body.fecha_prometida || null,
      cliente_id:      body.cliente_id ?? null,
      detalle:         body.detalle?.trim() || null,
      observaciones:   body.observaciones?.trim() || null,
      costo_trabajo,
      anticipo,
      subtotal,
      descuento_pct,
      descuento_monto,
      recargo_monto,
      total,
      estado: tipos.length > 0
        ? derivarEstado(tipos.map(t => ({ estado: t.estado ?? 'pendiente' })))
        : (ESTADOS_TRABAJO.includes(body.estado) ? body.estado : 'pendiente'),
      sucursal_id: sucursalId,
      vendedor_id: body.vendedor_id ?? null,
      created_by:  session.user.id,
    })
    .select()
    .single()

  if (servicioError) return NextResponse.json({ error: servicioError.message }, { status: 500 })

  if (tipos.length > 0) {
    const { error: tiposError } = await supabase
      .from('optica_servicio_tipos')
      .insert(tipos.map(t => ({
        servicio_id: servicio.id,
        tipo:    t.tipo,
        detalle: t.detalle?.trim() || null,
        precio:  Math.max(0, t.precio || 0),
        estado:  ESTADOS_TRABAJO.includes(t.estado ?? '') ? t.estado : 'pendiente',
      })))

    if (tiposError) {
      await supabase.from('optica_servicios').delete().eq('id', servicio.id)
      return NextResponse.json({ error: tiposError.message }, { status: 500 })
    }
  }

  // Crear pago de seña si se indicó anticipo con método
  const anticipo_metodo: string | undefined = body.anticipo_metodo
  if (anticipo > 0 && anticipo_metodo?.trim()) {
    let cajaSesionId: number | null = null
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

    const fechaPago = body.anticipo_fecha || new Date().toISOString().slice(0, 10)
    const { error: anticipoError } = await supabase.from('optica_servicio_pagos').insert({
      servicio_id:    servicio.id,
      caja_sesion_id: cajaSesionId,
      metodo:         anticipo_metodo,
      monto:          anticipo,
      concepto:       'SEÑA',
      referencia:     body.anticipo_referencia?.trim() || null,
      fecha_pago:     fechaPago,
      forma_pago_id:  body.anticipo_forma_id ?? null,
      usuario_id:     session.user.id,
    })
    if (anticipoError) return NextResponse.json({ error: `Servicio creado pero falló el anticipo: ${anticipoError.message}` }, { status: 500 })
    if (anticipo_metodo === 'CUENTA_CORRIENTE' && servicio.cliente_id) {
      await supabase.from('cobranzas').insert({
        cliente_id:  servicio.cliente_id,
        tipo:        'CARGO',
        monto:       anticipo,
        fecha:       fechaPago,
        descripcion: `${numero} – SEÑA`,
        sucursal_id: sucursalId,
        usuario_id:  session.user.id,
      })
    }
    if (cajaSesionId && anticipo_metodo !== 'CUENTA_CORRIENTE' && anticipo_metodo !== 'NOTA_CREDITO') {
      await supabase.from('caja_movimientos').insert({
        sesion_id:  cajaSesionId,
        tipo:       'ingreso',
        concepto:   `${numero} – SEÑA`,
        monto:      anticipo,
        usuario_id: session.user.id,
      })
    }
  }

  return NextResponse.json({ id: servicio.id, numero }, { status: 201 })
}
