import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getSucursalFilter } from '@/lib/sucursal'

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

  let ventasHoy = '—'
  let stockBajo = '—'
  let cajaTotal = '—'
  let cajaIngresos = '—'
  let cajaEgresos = '—'
  let saldoCobrar = '—'

  if (session && (sucursalId || verTodas)) {
    const supabase = await getTenantClient(session)
    const today = new Date().toISOString().slice(0, 10)

    // ── Queries paralelas ────────────────────────────────────────────────────
    let qPOS = supabase.from('ventas').select('total').eq('fecha', today).neq('estado', 'anulada')
    let qOT  = supabase.from('optica_ordenes').select('total').eq('fecha', today).neq('estado', 'anulado')
    const qOrdenes = supabase.from('ordenes_venta').select('total').eq('fecha', today).neq('estado', 'anulada')
    const qArticulos = supabase.from('articulos').select('stock_actual, stock_minimo').eq('activo', true)
    let qCajaSesiones = supabase.from('caja_sesiones').select('id, monto_apertura').eq('estado', 'abierta')
    let qOTSaldo = supabase.from('optica_ordenes').select('total, optica_orden_pagos(monto)').neq('estado', 'anulado')
    const qOrdSaldo = supabase.from('ordenes_venta').select('total, orden_venta_pagos(monto)').eq('estado', 'confirmada')
    const qCobranzas = supabase.from('cobranzas').select('tipo, monto')

    if (!verTodas && sucursalId) {
      qPOS = qPOS.eq('sucursal_id', sucursalId)
      qOT  = qOT.eq('sucursal_id', sucursalId)
      qCajaSesiones = qCajaSesiones.eq('sucursal_id', sucursalId)
      qOTSaldo = qOTSaldo.eq('sucursal_id', sucursalId)
    }

    const [
      { data: posHoy },
      { data: otHoy },
      { data: ordenesHoy },
      { data: articulos },
      { data: sesiones },
      { data: otSaldo },
      { data: ordSaldo },
      { data: cobranzas },
    ] = await Promise.all([qPOS, qOT, qOrdenes, qArticulos, qCajaSesiones, qOTSaldo, qOrdSaldo, qCobranzas])

    // ── Ventas hoy ───────────────────────────────────────────────────────────
    const totalPOS = (posHoy ?? []).reduce((s, v) => s + Number(v.total), 0)
    const totalOT  = (otHoy ?? []).reduce((s, v) => s + Number(v.total), 0)
    const totalOrds = (ordenesHoy ?? []).reduce((s, v) => s + Number(v.total), 0)
    ventasHoy = ars(totalPOS + totalOT + totalOrds)

    // ── Stock bajo ───────────────────────────────────────────────────────────
    stockBajo = String(
      (articulos ?? []).filter(a => Number(a.stock_actual) < Number(a.stock_minimo)).length
    )

    // ── Caja: total, ingresos y egresos de sesiones abiertas ────────────────
    const sesionIds = (sesiones ?? []).map(s => s.id)
    if (sesionIds.length > 0) {
      const { data: movs } = await supabase
        .from('caja_movimientos')
        .select('tipo, monto')
        .in('sesion_id', sesionIds)
      const apertura = (sesiones ?? []).reduce((s, ses) => s + Number(ses.monto_apertura ?? 0), 0)
      const ing = (movs ?? []).filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)
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

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">
        Bienvenido, {session?.user.name || 'Usuario'}
      </h2>
      <p className="text-sm text-gray-500 mb-8">
        Panel de control — MGA Pto. Venta
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Ventas hoy" value={ventasHoy} />
        <MetricCard label="Artículos en stock bajo" value={stockBajo} />
        <CajaCard total={cajaTotal} ingresos={cajaIngresos} egresos={cajaEgresos} />
        <MetricCard label="Saldo a cobrar" value={saldoCobrar} />
      </div>
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
