'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, History } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CajaMovimiento } from '@/types/ventas'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SesionHistorial {
  id: number
  fecha_apertura: string
  fecha_cierre: string
  monto_apertura: number
  monto_cierre: number | null
  monto_esperado: number | null
  diferencia: number | null
  observaciones: string | null
  estado: string
  sucursales: { nombre: string } | null
}

interface MetodoMonto { metodo: string; label: string; monto: number }
interface ResumenData { ventas: MetodoMonto[]; ot: MetodoMonto[]; servicios: MetodoMonto[] }

// ── Tarjeta de sesión ─────────────────────────────────────────────────────────

function HistorialSesionCard({ s }: { s: SesionHistorial }) {
  const [expanded, setExpanded] = useState(false)
  const [resumen, setResumen] = useState<ResumenData | null>(null)
  const [movimientos, setMovimientos] = useState<CajaMovimiento[] | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  async function handleExpand() {
    if (expanded) { setExpanded(false); return }
    setExpanded(true)
    if (resumen !== null) return
    setLoadingDetail(true)
    const [rRes, mRes] = await Promise.all([
      fetch(`/api/dashboard/caja/sesion/${s.id}/resumen`),
      fetch(`/api/dashboard/caja/sesion/${s.id}/movimientos`),
    ])
    if (rRes.ok) setResumen(await rRes.json())
    if (mRes.ok) setMovimientos(await mRes.json())
    setLoadingDetail(false)
  }

  const diff = s.diferencia ?? 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Cabecera clickeable */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        onClick={handleExpand}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-medium text-gray-800">
              Apertura: {formatDateTime(s.fecha_apertura)}
            </p>
            {s.sucursales?.nombre && (
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 shrink-0">
                {s.sucursales.nombre}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Cierre: {formatDateTime(s.fecha_cierre)}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-400">Contado</p>
            <p className="text-sm font-semibold text-gray-800">{formatARS(s.monto_cierre ?? 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Diferencia</p>
            <p className={`text-sm font-semibold ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-green-600' : 'text-gray-400'}`}>
              {formatARS(diff)}
            </p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Detalle expandido */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Datos del cierre */}
          <div className="px-4 py-4 grid grid-cols-2 gap-3 bg-gray-50">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Monto apertura</p>
              <p className="text-sm font-medium">{formatARS(s.monto_apertura)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Monto esperado</p>
              <p className="text-sm font-medium">{formatARS(s.monto_esperado ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Monto contado</p>
              <p className="text-sm font-medium">{formatARS(s.monto_cierre ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Diferencia</p>
              <p className={`text-sm font-semibold ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-green-600' : ''}`}>
                {formatARS(diff)}
              </p>
            </div>
            {s.observaciones && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-0.5">Observaciones</p>
                <p className="text-sm text-gray-700">{s.observaciones}</p>
              </div>
            )}
          </div>

          {loadingDetail && (
            <p className="px-4 py-3 text-sm text-gray-400">Cargando detalle…</p>
          )}

          {/* Resumen por forma de pago */}
          {resumen && (() => {
            const toMap = (arr: MetodoMonto[]) => Object.fromEntries(arr.map(r => [r.metodo, r]))
            const vMap = toMap(resumen.ventas)
            const oMap = toMap(resumen.ot)
            const sMap = toMap(resumen.servicios)
            const allMetodos = Array.from(
              new Set([...resumen.ventas, ...resumen.ot, ...resumen.servicios].map(r => r.metodo))
            ).map(m => {
              const label = vMap[m]?.label ?? oMap[m]?.label ?? sMap[m]?.label ?? m
              const subtotal = (vMap[m]?.monto ?? 0) + (oMap[m]?.monto ?? 0) + (sMap[m]?.monto ?? 0)
              return { metodo: m, label, subtotal }
            }).sort((a, b) => b.subtotal - a.subtotal)

            const totalVentas    = resumen.ventas.reduce((acc, r) => acc + r.monto, 0)
            const totalOT        = resumen.ot.reduce((acc, r) => acc + r.monto, 0)
            const totalServicios = resumen.servicios.reduce((acc, r) => acc + r.monto, 0)
            const totalCobros    = totalVentas + totalOT + totalServicios

            const movs = movimientos ?? []
            const isPaymentMov = (m: CajaMovimiento) =>
              m.tipo === 'ingreso' && (
                m.concepto.startsWith('Venta ') || m.concepto.startsWith('OT ') ||
                m.concepto.startsWith('SV ') || m.concepto.startsWith('Orden ') ||
                /^OT-\d/.test(m.concepto) || /^SV-\d/.test(m.concepto)
              )
            const totalManualIng = movs.filter(m => m.tipo === 'ingreso' && !isPaymentMov(m)).reduce((acc, m) => acc + Number(m.monto), 0)
            const totalEgr = movs.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + Number(m.monto), 0)
            const netManual = totalManualIng - totalEgr

            if (allMetodos.length === 0 && netManual === 0) {
              return <p className="px-4 py-3 text-sm text-gray-400">Sin ventas ni cobros en esta sesión.</p>
            }

            return (
              <div className="divide-y divide-gray-100">
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Resumen por forma de pago</p>
                {allMetodos.map(({ metodo, label, subtotal }) => {
                  const esEfectivo = metodo === 'EFECTIVO'
                  const total = esEfectivo ? subtotal + netManual : subtotal
                  return (
                    <div key={metodo} className="px-4 py-2.5 space-y-1">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-semibold text-gray-600">{label}</p>
                        <span className="text-sm font-bold text-gray-900">{formatARS(total)}</span>
                      </div>
                      {vMap[metodo] && (
                        <div className="flex justify-between text-xs pl-2 text-gray-500">
                          <span>Ventas</span><span>{formatARS(vMap[metodo].monto)}</span>
                        </div>
                      )}
                      {oMap[metodo] && (
                        <div className="flex justify-between text-xs pl-2 text-gray-500">
                          <span>Órdenes de trabajo</span><span>{formatARS(oMap[metodo].monto)}</span>
                        </div>
                      )}
                      {sMap[metodo] && (
                        <div className="flex justify-between text-xs pl-2 text-gray-500">
                          <span>Servicios</span><span>{formatARS(sMap[metodo].monto)}</span>
                        </div>
                      )}
                      {esEfectivo && netManual !== 0 && (
                        <div className="flex justify-between text-xs pl-2 text-gray-500">
                          <span>Mov. de caja</span>
                          <span className={netManual < 0 ? 'text-red-600' : ''}>{formatARS(netManual)}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div className="px-4 py-2.5 bg-gray-50 flex justify-between text-sm font-bold">
                  <span>Total cobros</span>
                  <span>{formatARS(totalCobros)}</span>
                </div>
              </div>
            )
          })()}

          {/* Movimientos manuales */}
          {movimientos !== null && movimientos.filter(m =>
            !(m.tipo === 'ingreso' && (
              m.concepto.startsWith('Venta ') || m.concepto.startsWith('OT ') ||
              m.concepto.startsWith('SV ') || m.concepto.startsWith('Orden ')
            ))
          ).length > 0 && (
            <div className="border-t border-gray-100">
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Movimientos manuales</p>
              <div className="divide-y divide-gray-50">
                {movimientos.filter(m =>
                  !(m.tipo === 'ingreso' && (
                    m.concepto.startsWith('Venta ') || m.concepto.startsWith('OT ') ||
                    m.concepto.startsWith('SV ') || m.concepto.startsWith('Orden ')
                  ))
                ).map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {m.tipo_concepto && (
                          <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                            {m.tipo_concepto}
                          </span>
                        )}
                        {m.concepto && (
                          <p className="text-sm text-gray-700 truncate">{m.concepto}</p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(m.created_at)}</p>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-500'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{formatARS(m.monto)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default function CajaHistorialPage() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const [desde, setDesde] = useState(today)
  const [hasta, setHasta] = useState(today)
  const [sesiones, setSesiones] = useState<SesionHistorial[] | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (d: string, h: string) => {
    if (!DATE_RE.test(d) || !DATE_RE.test(h)) return
    setLoading(true)
    setSesiones(null)
    const res = await fetch(`/api/dashboard/caja/historial?desde=${d}&hasta=${h}`)
    if (res.ok) setSesiones(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load(today, today) }, [load, today])

  function handleDesdeChange(v: string) {
    setDesde(v)
    if (DATE_RE.test(v) && DATE_RE.test(hasta)) load(v, hasta)
  }

  function handleHastaChange(v: string) {
    setHasta(v)
    if (DATE_RE.test(desde) && DATE_RE.test(v)) load(desde, v)
  }

  const rangoLabel = desde === hasta
    ? new Date(desde + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : `${new Date(desde + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })} — ${new Date(hasta + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`

  return (
    <div className="max-w-2xl space-y-4">

      <h2 className="text-lg font-semibold text-gray-800">Historial de cierres</h2>

      {/* Filtro de rango */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <History className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-600 shrink-0">Desde</Label>
            <Input
              type="date"
              value={desde}
              max={hasta}
              onChange={(e) => handleDesdeChange(e.target.value)}
              className="h-8 text-sm w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-600 shrink-0">Hasta</Label>
            <Input
              type="date"
              value={hasta}
              min={desde}
              max={today}
              onChange={(e) => handleHastaChange(e.target.value)}
              className="h-8 text-sm w-40"
            />
          </div>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-gray-400 px-1">Cargando…</p>
      )}

      {!loading && sesiones !== null && sesiones.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <p className="text-sm text-gray-400">
            No hay cierres registrados para {rangoLabel}.
          </p>
        </div>
      )}

      {!loading && sesiones !== null && sesiones.map(s => (
        <HistorialSesionCard key={s.id} s={s} />
      ))}

    </div>
  )
}
