import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getSucursalFilter } from '@/lib/sucursal'
import { ModuleSections } from '@/components/dashboard/ModuleSections'

function ars(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n)
}

type PagoRow = { monto: number }
type ConPagos = { total: number; [key: string]: unknown }

function sumPagado(pagos: unknown): number {
  if (!Array.isArray(pagos)) return 0
  return pagos.reduce((s: number, p: PagoRow) => s + Number(p.monto), 0)
}

export default async function DashboardPage() {
  const session = await auth()
  const { sucursalId, verTodas } = await getSucursalFilter()

  let permMap: Record<string, boolean> | null = null
  if (session && session.user.role !== 'Administrador') {
    const supabase = await getTenantClient(session)
    const { data } = await supabase
      .from('role_permissions')
      .select('operation, allowed')
      .eq('role_id', session.user.role_id)
    permMap = {}
    for (const row of (data ?? []) as Array<{ operation: string; allowed: boolean }>) {
      permMap[row.operation] = row.allowed
    }
  }

  let ventasHoy   = '—'
  let trabajosHoy = '—'
  let stockBajo   = '—'
  let cajaTotal   = '—'
  let cajaIngresos = '—'
  let cajaEgresos  = '—'
  let saldoCobrar  = '—'

  if (session && (sucursalId || verTodas)) {
    const supabase = await getTenantClient(session)
    const today = new Date().toISOString().slice(0, 10)

    // ── Queries paralelas ────────────────────────────────────────────────────
    let qPOS          = supabase.from('ventas').select('total').eq('fecha', today).neq('estado', 'anulada')
    let qOT           = supabase.from('optica_ordenes').select('total').eq('fecha', today).neq('estado', 'anulado')
    let qOrdenes      = supabase.from('ordenes_venta').select('total').eq('fecha', today).eq('estado', 'confirmada')
    let qServicios    = supabase.from('optica_servicios').select('total').eq('fecha', today).neq('estado', 'anulado')
    const qArticulos  = supabase.from('articulos').select('stock_actual, stock_minimo').eq('activo', true)
    let qCajaSesiones = supabase.from('caja_sesiones').select('id, monto_apertura').eq('estado', 'abierta')
    let qOTSaldo      = supabase.from('optica_ordenes').select('total, optica_orden_pagos(monto)').neq('estado', 'anulado')
    let qOrdSaldo     = supabase.from('ordenes_venta').select('total, orden_venta_pagos(monto)').eq('estado', 'confirmada')
    let qCobranzas  = supabase.from('cobranzas').select('tipo, monto')

    if (!verTodas && sucursalId) {
      qPOS          = qPOS.eq('sucursal_id', sucursalId)
      qOT           = qOT.eq('sucursal_id', sucursalId)
      qOrdenes      = qOrdenes.eq('sucursal_id', sucursalId)
      qServicios    = qServicios.eq('sucursal_id', sucursalId)
      qCajaSesiones = qCajaSesiones.eq('sucursal_id', sucursalId)
      qOTSaldo      = qOTSaldo.eq('sucursal_id', sucursalId)
      qOrdSaldo     = qOrdSaldo.eq('sucursal_id', sucursalId)
      qCobranzas    = qCobranzas.or(`sucursal_id.eq.${sucursalId},sucursal_id.is.null`)
    }

    const [
      { data: posHoy },
      { data: otHoy },
      { data: ordenesHoy },
      { data: serviciosHoy },
      { data: articulos },
      { data: sesiones },
      { data: otSaldo },
      { data: ordSaldo },
      { data: cobranzas },
    ] = await Promise.all([qPOS, qOT, qOrdenes, qServicios, qArticulos, qCajaSesiones, qOTSaldo, qOrdSaldo, qCobranzas])

    // ── Ventas hoy (POS + Órdenes de venta confirmadas) ─────────────────────
    const totalPOS  = (posHoy     ?? []).reduce((s, v) => s + Number(v.total), 0)
    const totalOT   = (otHoy      ?? []).reduce((s, v) => s + Number(v.total), 0)
    const totalOrds = (ordenesHoy ?? []).reduce((s, v) => s + Number(v.total), 0)
    ventasHoy = ars(totalPOS + totalOrds)

    // ── Trabajos hoy (Órdenes de trabajo + Servicios) ────────────────────────
    const totalSv = (serviciosHoy ?? []).reduce((s, v) => s + Number(v.total), 0)
    trabajosHoy = ars(totalOT + totalSv)

    // ── Stock bajo ───────────────────────────────────────────────────────────
    stockBajo = String(
      (articulos ?? []).filter(a => Number(a.stock_actual) < Number(a.stock_minimo)).length
    )

    // ── Caja: total, ingresos y egresos de sesiones abiertas ────────────────
    const sesionIds = (sesiones ?? []).map(s => s.id)
    if (sesionIds.length > 0) {
      const { data: movs } = await supabase
        .from('caja_movimientos')
        .select('tipo, tipo_concepto, monto')
        .in('sesion_id', sesionIds)
      const apertura = (sesiones ?? []).reduce((s, ses) => s + Number(ses.monto_apertura ?? 0), 0)
      // Excluir movimiento "Apertura" de ing para no contar monto_apertura dos veces
      const ing = (movs ?? []).filter(m => m.tipo === 'ingreso' && m.tipo_concepto !== 'Apertura').reduce((s, m) => s + Number(m.monto), 0)
      const egr = (movs ?? []).filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0)
      cajaIngresos = ars(ing)
      cajaEgresos  = ars(egr)
      cajaTotal    = ars(apertura + ing - egr)
    } else {
      cajaTotal = cajaIngresos = cajaEgresos = 'Cerrada'
    }

    // ── Saldo a cobrar ───────────────────────────────────────────────────────
    const saldoCC = (cobranzas ?? []).reduce(
      (acc, c) => acc + (c.tipo === 'CARGO' ? Number(c.monto) : -Number(c.monto)),
      0
    )
    const saldoOT = (otSaldo ?? []).reduce((acc, row) => {
      const r = row as ConPagos
      const pagado = sumPagado(r.optica_orden_pagos)
      return acc + Math.max(0, Number(r.total) - pagado)
    }, 0)
    const saldoOrds = (ordSaldo ?? []).reduce((acc, row) => {
      const r = row as ConPagos
      const pagado = sumPagado(r.orden_venta_pagos)
      return acc + Math.max(0, Number(r.total) - pagado)
    }, 0)
    saldoCobrar = ars(Math.max(0, saldoCC + saldoOT + saldoOrds))
  }

  const isAdmin = session?.user.role === 'Administrador'
  const modules = session?.user.modules ?? []

  // null permMap = admin, ve todo; si tiene al menos un permiso activo del grupo, muestra las cards
  const hasAnyPerm = (prefix: string) =>
    !permMap || Object.entries(permMap).some(([k, v]) => k.startsWith(prefix + '.') && v === true)

  const showVentas      = hasAnyPerm('ventas')
  const showTrabajos    = hasAnyPerm('optica')
  const showStockBajo   = hasAnyPerm('inventario')
  const showCaja        = hasAnyPerm('caja')
  const showSaldoCobrar = showVentas || showTrabajos || showCaja

  const anyCard = showVentas || showTrabajos || showStockBajo || showCaja || showSaldoCobrar

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">
        Bienvenido, {session?.user.name || 'Usuario'}
      </h2>
      <p className="text-sm text-gray-500 mb-8">
        Panel de control — MGA Pto. Venta
      </p>

      {anyCard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {showVentas     && <MetricCard label="Ventas hoy" value={ventasHoy} />}
          {showTrabajos   && <MetricCard label="Trabajos hoy" value={trabajosHoy} />}
          {showStockBajo  && <MetricCard label="Artículos en stock bajo" value={stockBajo} />}
          {showCaja       && <CajaCard total={cajaTotal} ingresos={cajaIngresos} egresos={cajaEgresos} />}
          {showSaldoCobrar && <MetricCard label="Saldo a cobrar" value={saldoCobrar} />}
        </div>
      )}

      <ModuleSections modules={modules} isAdmin={isAdmin} userPermissions={permMap} />
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function CajaCard({ total, ingresos, egresos }: { total: string; ingresos: string; egresos: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">Caja</p>
      <p className="text-2xl font-bold text-gray-900 mb-3">{total}</p>
      <div className="space-y-1 border-t border-gray-100 pt-3">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Ingresos</span>
          <span className="text-green-600 font-medium">{ingresos}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Egresos</span>
          <span className="text-red-500 font-medium">{egresos}</span>
        </div>
      </div>
    </div>
  )
}

