import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getHomeSucursalId } from '@/lib/sucursal'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type MovRow = {
  id: number
  tipo: 'ingreso' | 'egreso'
  concepto: string
  monto: number
  metodo: string
  fuente: string
  referencia: string | null
  created_at: string
  sesion_id: number | null
  sucursal_id: number | null
  sucursal_nombre: string | null
}

export type MovimientosResponse = {
  movimientos: MovRow[]
  total_ingresos: number
  total_egresos: number
  saldo: number
}

const METODO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia',
  TARJETA_DEBITO: 'Tarjeta débito', TARJETA_CREDITO: 'Tarjeta crédito',
  CHEQUE: 'Cheque', OTRO: 'Otro', CUENTA_CORRIENTE: 'Cuenta corriente',
  NOTA_CREDITO: 'Nota de crédito',
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const params = req.nextUrl.searchParams
  const desde = params.get('desde')
  const hasta = params.get('hasta')
  const sucursalParam = params.get('sucursal_id')

  if (!desde || !DATE_RE.test(desde))
    return NextResponse.json({ error: 'desde requerida (YYYY-MM-DD)' }, { status: 400 })
  if (!hasta || !DATE_RE.test(hasta))
    return NextResponse.json({ error: 'hasta requerida (YYYY-MM-DD)' }, { status: 400 })

  const sucursalId = sucursalParam ? parseInt(sucursalParam, 10) : await getHomeSucursalId()

  const desdeISO = `${desde}T00:00:00.000Z`
  const hastaISO = `${hasta}T23:59:59.999Z`

  const all: MovRow[] = []

  // ── Sucursal names map ────────────────────────────────────────────────────
  const { data: sucursales } = await supabase
    .from('sucursales')
    .select('id, nombre')
    .eq('activo', true)
  const sucMap = new Map((sucursales ?? []).map(s => [s.id, s.nombre]))

  // ── 1. caja_movimientos ─────────────────────────────────────────────────
  let cajaQ = supabase
    .from('caja_movimientos')
    .select('id, tipo, concepto, monto, tipo_concepto, created_at, sesion_id')
    .gte('created_at', desdeISO)
    .lte('created_at', hastaISO)
    .order('created_at', { ascending: false })

  if (sucursalId) {
    cajaQ = cajaQ.eq('sesion_id',
      supabase.from('caja_sesiones').select('id').eq('sucursal_id', sucursalId) as unknown as number
    )
  }

  const { data: cajaMovs, error: cajaErr } = await cajaQ
  if (cajaErr) console.error('caja_movimientos error:', cajaErr)

  if (sucursalId && cajaMovs && cajaMovs.length > 0) {
    const sesionIds = [...new Set(cajaMovs.map(m => m.sesion_id).filter(Boolean))]
    const { data: sesiones } = await supabase.from('caja_sesiones').select('id, sucursal_id').in('id', sesionIds).eq('sucursal_id', sucursalId)
    const validSesiones = new Set((sesiones ?? []).map(s => s.id))
    const filtered = cajaMovs.filter(m => !m.sesion_id || validSesiones.has(m.sesion_id))
    for (const m of filtered) {
      all.push({
        id: m.id,
        tipo: m.tipo as 'ingreso' | 'egreso',
        concepto: m.concepto,
        monto: Number(m.monto),
        metodo: m.tipo_concepto ?? '',
        fuente: 'caja',
        referencia: null,
        created_at: m.created_at,
        sesion_id: m.sesion_id,
        sucursal_id: sucursalId,
        sucursal_nombre: sucMap.get(sucursalId) ?? null,
      })
    }
  } else if (!sucursalId) {
    for (const m of cajaMovs ?? []) {
      all.push({
        id: m.id,
        tipo: m.tipo as 'ingreso' | 'egreso',
        concepto: m.concepto,
        monto: Number(m.monto),
        metodo: m.tipo_concepto ?? '',
        fuente: 'caja',
        referencia: null,
        created_at: m.created_at,
        sesion_id: m.sesion_id,
        sucursal_id: null,
        sucursal_nombre: null,
      })
    }
  }

  // ── 2. Ventas POS ───────────────────────────────────────────────────────
  const { data: vpRows } = await supabase
    .from('venta_pagos')
    .select('id, metodo, monto, created_at, venta_id')
    .gte('created_at', desdeISO)
    .lte('created_at', hastaISO)

  if (vpRows && vpRows.length > 0) {
    const ventaIds = [...new Set(vpRows.map(p => p.venta_id).filter(Boolean))]
    let { data: ventas } = await supabase.from('ventas').select('id, numero, estado, sucursal_id').in('id', ventaIds)
    if (sucursalId) ventas = (ventas ?? []).filter(v => v.sucursal_id === sucursalId)
    const ventasMap = new Map((ventas ?? []).map(v => [v.id, v]))

    for (const p of vpRows) {
      const v = ventasMap.get(p.venta_id)
      if (!v || v.estado !== 'completada') continue
      all.push({
        id: p.id, tipo: 'ingreso',
        concepto: `Venta #${v.numero}`,
        monto: Number(p.monto),
        metodo: METODO_LABELS[p.metodo] ?? p.metodo,
        fuente: 'venta', referencia: null,
        created_at: p.created_at, sesion_id: null,
        sucursal_id: v.sucursal_id,
        sucursal_nombre: sucMap.get(v.sucursal_id) ?? null,
      })
    }
  }

  // ── 3. Órdenes de venta ─────────────────────────────────────────────────
  const { data: ovPagos } = await supabase
    .from('orden_venta_pagos')
    .select('id, metodo, monto, created_at, orden_id')
    .gte('created_at', desdeISO)
    .lte('created_at', hastaISO)

  if (ovPagos && ovPagos.length > 0) {
    const ordenIds = [...new Set(ovPagos.map(p => p.orden_id).filter(Boolean))]
    let { data: ordenes } = await supabase.from('ordenes_venta').select('id, numero, estado, sucursal_id').in('id', ordenIds)
    if (sucursalId) ordenes = (ordenes ?? []).filter(o => o.sucursal_id === sucursalId)
    const ordenesMap = new Map((ordenes ?? []).map(o => [o.id, o]))

    for (const p of ovPagos) {
      const o = ordenesMap.get(p.orden_id)
      if (!o || o.estado === 'anulada') continue
      all.push({
        id: p.id, tipo: 'ingreso',
        concepto: `OV #${o.numero}`,
        monto: Number(p.monto),
        metodo: METODO_LABELS[p.metodo] ?? p.metodo,
        fuente: 'ov', referencia: null,
        created_at: p.created_at, sesion_id: null,
        sucursal_id: o.sucursal_id,
        sucursal_nombre: sucMap.get(o.sucursal_id) ?? null,
      })
    }
  }

  // ── 4. OT ───────────────────────────────────────────────────────────────
  const { data: otPagos } = await supabase
    .from('optica_orden_pagos')
    .select('id, metodo, monto, created_at, referencia, caja_sesion_id, orden_id')
    .gte('created_at', desdeISO)
    .lte('created_at', hastaISO)

  if (otPagos && otPagos.length > 0) {
    const otIds = [...new Set(otPagos.map(p => p.orden_id).filter(Boolean))]
    let { data: ots } = await supabase.from('optica_ordenes').select('id, numero, sucursal_id').in('id', otIds)
    if (sucursalId) ots = (ots ?? []).filter(o => o.sucursal_id === sucursalId)
    const otsMap = new Map((ots ?? []).map(o => [o.id, o]))

    for (const p of otPagos) {
      const o = otsMap.get(p.orden_id)
      if (!o) continue
      all.push({
        id: p.id, tipo: 'ingreso',
        concepto: `OT #${o.numero}`,
        monto: Number(p.monto),
        metodo: METODO_LABELS[p.metodo] ?? p.metodo,
        fuente: 'ot', referencia: p.referencia ?? null,
        created_at: p.created_at, sesion_id: p.caja_sesion_id ?? null,
        sucursal_id: o.sucursal_id,
        sucursal_nombre: sucMap.get(o.sucursal_id) ?? null,
      })
    }
  }

  // ── 5. Servicios ────────────────────────────────────────────────────────
  const { data: svPagos } = await supabase
    .from('optica_servicio_pagos')
    .select('id, metodo, monto, created_at, referencia, caja_sesion_id, servicio_id')
    .gte('created_at', desdeISO)
    .lte('created_at', hastaISO)

  if (svPagos && svPagos.length > 0) {
    const svIds = [...new Set(svPagos.map(p => p.servicio_id).filter(Boolean))]
    let { data: svs } = await supabase.from('optica_servicios').select('id, numero, sucursal_id').in('id', svIds)
    if (sucursalId) svs = (svs ?? []).filter(s => s.sucursal_id === sucursalId)
    const svsMap = new Map((svs ?? []).map(s => [s.id, s]))

    for (const p of svPagos) {
      const s = svsMap.get(p.servicio_id)
      if (!s) continue
      all.push({
        id: p.id, tipo: 'ingreso',
        concepto: `SV #${s.numero}`,
        monto: Number(p.monto),
        metodo: METODO_LABELS[p.metodo] ?? p.metodo,
        fuente: 'sv', referencia: p.referencia ?? null,
        created_at: p.created_at, sesion_id: p.caja_sesion_id ?? null,
        sucursal_id: s.sucursal_id,
        sucursal_nombre: sucMap.get(s.sucursal_id) ?? null,
      })
    }
  }

  all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const total_ingresos = all.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const total_egresos = all.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)

  const response: MovimientosResponse = {
    movimientos: all,
    total_ingresos,
    total_egresos,
    saldo: total_ingresos - total_egresos,
  }

  return NextResponse.json(response)
}
