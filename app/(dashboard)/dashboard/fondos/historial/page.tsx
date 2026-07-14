'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, History, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { CajaMovimiento } from '@/types/ventas'
import { usePermissions } from '@/components/PermissionsProvider'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SesionHistorial {
  id: number
  fecha_apertura: string
  fecha_cierre: string | null
  monto_apertura: number
  monto_cierre: number | null
  monto_esperado: number | null
  diferencia: number | null
  observaciones: string | null
  estado: string
  fecha: string
  sucursales: { nombre: string } | null
}

interface MetodoMonto { metodo: string; label: string; monto: number }
interface ResumenData { ventas: MetodoMonto[]; ordenes: MetodoMonto[]; ot: MetodoMonto[]; servicios: MetodoMonto[] }

interface MovDia {
  id: number
  tipo: 'ingreso' | 'egreso'
  concepto: string
  monto: number
  metodo: string
  fuente: string
  referencia: string | null
  created_at: string
  sesion_id: number | null
}

const FUENTE_LABELS: Record<string, string> = {
  venta: 'Venta POS',
  ov: 'Orden de venta',
  ot: 'Orden de trabajo',
  sv: 'Servicio',
  caja: 'Caja',
}

// ── Solapa Movimientos por día ────────────────────────────────────────────────

function MovimientosDiaTab({ fecha }: { fecha: string }) {
  const [movs, setMovs] = useState<MovDia[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    fetch(`/api/dashboard/caja/movimientos-por-dia?fecha=${fecha}`)
      .then(r => r.json())
      .then(d => { if (!cancel) { setMovs(d); setLoading(false) } })
      .catch(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [fecha])

  if (loading) return <p className="text-sm text-gray-400 px-1 py-4">Cargando movimientos…</p>
  if (!movs) return null
  if (movs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
        <p className="text-sm text-gray-400">Sin movimientos para el {formatDate(fecha)}.</p>
      </div>
    )
  }

  // Totales
  const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const egresos = movs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)

  // Por fuente
  const porFuente = Object.entries(
    movs.reduce<Record<string, { ingreso: number; egreso: number; count: number }>>((acc, m) => {
      if (!acc[m.fuente]) acc[m.fuente] = { ingreso: 0, egreso: 0, count: 0 }
      acc[m.fuente].count++
      if (m.tipo === 'ingreso') acc[m.fuente].ingreso += m.monto
      else acc[m.fuente].egreso += m.monto
      return acc
    }, {})
  ).sort((a, b) => (b[1].ingreso + b[1].egreso) - (a[1].ingreso + a[1].egreso))

  return (
    <div className="space-y-3">
      {/* Resumen */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Resumen del día</p>
          <p className="text-xs text-gray-400">{movs.length} movimiento{movs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Ingresos</p>
            <p className="text-sm font-semibold text-green-600">{formatARS(ingresos)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Egresos</p>
            <p className="text-sm font-semibold text-red-500">{formatARS(egresos)}</p>
          </div>
          <div className="col-span-2 border-t border-gray-100 pt-2">
            <p className="text-xs text-gray-400 mb-0.5">Neto</p>
            <p className="text-base font-bold text-gray-900">{formatARS(ingresos - egresos)}</p>
          </div>
        </div>

        {/* Por fuente */}
        {porFuente.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Por origen</p>
            {porFuente.map(([fuente, data]) => (
              <div key={fuente} className="flex justify-between text-sm">
                <span className="text-gray-600">{FUENTE_LABELS[fuente] ?? fuente} <span className="text-gray-400">({data.count})</span></span>
                <span className="font-medium text-gray-800">{formatARS(data.ingreso - data.egreso)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {movs.map(m => (
            <div key={`${m.fuente}-${m.id}`} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                    {FUENTE_LABELS[m.fuente] ?? m.fuente}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded shrink-0">
                    {m.metodo}
                  </span>
                  <p className="text-sm text-gray-700 truncate">{m.concepto}</p>
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
    </div>
  )
}

// ── Tarjeta de sesión (Cierres) ──────────────────────────────────────────────

function HistorialSesionCard({ s, onAnular }: { s: SesionHistorial; onAnular?: (sesionId: number, movimientoId: number) => void }) {
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
  const esAbierta = s.estado === 'abierta'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
            <Badge variant={esAbierta ? 'default' : 'secondary'} className="text-xs">
              {esAbierta ? 'Abierta' : 'Cerrada'}
            </Badge>
          </div>
          <p className="text-xs text-gray-400">
            {esAbierta ? `Día: ${formatDate(s.fecha)}` : `Cierre: ${formatDateTime(s.fecha_cierre)}`}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-400">{esAbierta ? 'Monto actual' : 'Contado'}</p>
            <p className="text-sm font-semibold text-gray-800">{formatARS(esAbierta ? s.monto_apertura : (s.monto_cierre ?? 0))}</p>
          </div>
          {!esAbierta && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Diferencia</p>
              <p className={`text-sm font-semibold ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                {formatARS(diff)}
              </p>
            </div>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          <div className="px-4 py-4 grid grid-cols-2 gap-3 bg-gray-50">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Monto apertura</p>
              <p className="text-sm font-medium">{formatARS(s.monto_apertura)}</p>
            </div>
            {!esAbierta && (
              <>
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
              </>
            )}
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
            const ordMap = toMap(resumen.ordenes)
            const oMap = toMap(resumen.ot)
            const sMap = toMap(resumen.servicios)
            const allMetodos = Array.from(
              new Set([...resumen.ventas, ...resumen.ordenes, ...resumen.ot, ...resumen.servicios].map(r => r.metodo))
            ).map(m => {
              const label = vMap[m]?.label ?? oMap[m]?.label ?? sMap[m]?.label ?? m
              const subtotal = (vMap[m]?.monto ?? 0) + (ordMap[m]?.monto ?? 0) + (oMap[m]?.monto ?? 0) + (sMap[m]?.monto ?? 0)
              return { metodo: m, label, subtotal }
            }).sort((a, b) => b.subtotal - a.subtotal)

            const totalVentas    = resumen.ventas.reduce((acc, r) => acc + r.monto, 0)
            const totalOrdenes   = resumen.ordenes.reduce((acc, r) => acc + r.monto, 0)
            const totalOT        = resumen.ot.reduce((acc, r) => acc + r.monto, 0)
            const totalServicios = resumen.servicios.reduce((acc, r) => acc + r.monto, 0)
            const totalCobros    = totalVentas + totalOrdenes + totalOT + totalServicios

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
                          <span>Ventas POS</span><span>{formatARS(vMap[metodo].monto)}</span>
                        </div>
                      )}
                      {ordMap[metodo] && (
                        <div className="flex justify-between text-xs pl-2 text-gray-500">
                          <span>Órdenes de venta</span><span>{formatARS(ordMap[metodo].monto)}</span>
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
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-semibold ${m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-500'}`}>
                        {m.tipo === 'ingreso' ? '+' : '-'}{formatARS(m.monto)}
                      </span>
                      {m.tipo_concepto !== 'Apertura' && m.tipo_concepto !== 'Anulación' && m.tipo_concepto !== 'Continuación' && onAnular && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => onAnular(s.id, m.id)}
                        >
                          Anular
                        </Button>
                      )}
                    </div>
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

// ── Dialogo anular movimiento ─────────────────────────────────────────────────

function AnularMovimientoDialog({ open, onClose, onConfirm, saving }: {
  open: boolean
  onClose: () => void
  onConfirm: (motivo: string) => void
  saving: boolean
}) {
  const [motivo, setMotivo] = useState('')

  useEffect(() => { if (!open) setMotivo('') }, [open])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Anular movimiento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700">
              Se creará un movimiento inverso para compensar este movimiento. Esta acción queda registrada en el log de auditoría.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Motivo de anulación *</Label>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describí el motivo de la anulación..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(motivo)}
            disabled={saving || !motivo.trim()}
          >
            {saving ? 'Anulando…' : 'Confirmar anulación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default function CajaHistorialPage() {
  const { can } = usePermissions()
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const [fecha, setFecha] = useState(today)
  const [activeTab, setActiveTab] = useState('movimientos')

  // Cierres state
  const [desde, setDesde] = useState(today)
  const [hasta, setHasta] = useState(today)
  const [filtro, setFiltro] = useState<'cerradas' | 'abiertas' | 'todas'>('cerradas')
  const [sesiones, setSesiones] = useState<SesionHistorial[] | null>(null)
  const [loadingCierres, setLoadingCierres] = useState(false)

  // Anulación
  const [anularDialog, setAnularDialog] = useState<{ sesionId: number; movimientoId: number } | null>(null)
  const [anulando, setAnulando] = useState(false)

  const loadCierres = useCallback(async (d: string, h: string, f: string) => {
    if (!DATE_RE.test(d) || !DATE_RE.test(h)) return
    setLoadingCierres(true)
    setSesiones(null)
    const res = await fetch(`/api/dashboard/caja/historial?desde=${d}&hasta=${h}&filtro=${f}`)
    if (res.ok) setSesiones(await res.json())
    setLoadingCierres(false)
  }, [])

  useEffect(() => { loadCierres(desde, hasta, filtro) }, [loadCierres, desde, hasta, filtro])

  function handleDesdeChange(v: string) {
    setDesde(v)
    if (DATE_RE.test(v) && DATE_RE.test(hasta)) loadCierres(v, hasta, filtro)
  }

  function handleHastaChange(v: string) {
    setHasta(v)
    if (DATE_RE.test(desde) && DATE_RE.test(v)) loadCierres(desde, v, filtro)
  }

  function handleFiltroChange(v: string) {
    const f = v as 'cerradas' | 'abiertas' | 'todas'
    setFiltro(f)
    if (DATE_RE.test(desde) && DATE_RE.test(hasta)) loadCierres(desde, hasta, f)
  }

  async function handleAnular(motivo: string) {
    if (!anularDialog || !motivo.trim()) return
    setAnulando(true)
    const res = await fetch(`/api/dashboard/caja/sesion/${anularDialog.sesionId}/anular-movimiento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movimiento_id: anularDialog.movimientoId, motivo }),
    })
    if (res.ok) {
      setAnularDialog(null)
      loadCierres(desde, hasta, filtro)
    } else {
      const err = await res.json()
      alert(err.error ?? 'Error al anular')
    }
    setAnulando(false)
  }

  return (
    <div className="max-w-2xl space-y-4">

      <h2 className="text-lg font-semibold text-gray-800">Historial</h2>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="cierres">Cierres</TabsTrigger>
        </TabsList>

        {/* ── Solapa Movimientos ──────────────────────────────────────── */}
        <TabsContent value="movimientos">
          <div className="space-y-3">
            {/* Selector de fecha */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <Label className="text-sm text-gray-600 shrink-0">Fecha</Label>
                <Input
                  type="date"
                  value={fecha}
                  max={today}
                  onChange={(e) => { const v = e.target.value; if (DATE_RE.test(v)) setFecha(v) }}
                  className="h-8 text-sm w-40"
                />
              </div>
            </div>
            <MovimientosDiaTab fecha={fecha} />
          </div>
        </TabsContent>

        {/* ── Solapa Cierres ──────────────────────────────────────────── */}
        <TabsContent value="cierres">
          <div className="space-y-3">
            {/* Filtros de rango */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
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
              <Tabs value={filtro} onValueChange={handleFiltroChange}>
                <TabsList className="h-8">
                  <TabsTrigger value="cerradas" className="text-xs">Cerradas</TabsTrigger>
                  <TabsTrigger value="abiertas" className="text-xs">Abiertas</TabsTrigger>
                  <TabsTrigger value="todas" className="text-xs">Todas</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {loadingCierres && (
              <p className="text-sm text-gray-400 px-1">Cargando…</p>
            )}

            {!loadingCierres && sesiones !== null && sesiones.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                <p className="text-sm text-gray-400">No hay sesiones registradas en este rango.</p>
              </div>
            )}

            {!loadingCierres && sesiones !== null && sesiones.map(s => (
              <HistorialSesionCard
                key={s.id}
                s={s}
                onAnular={can('fondos.caja.anular') ? (sesionId, movId) => setAnularDialog({ sesionId, movimientoId: movId }) : undefined}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Diálogo anular */}
      <AnularMovimientoDialog
        open={anularDialog !== null}
        onClose={() => setAnularDialog(null)}
        onConfirm={handleAnular}
        saving={anulando}
      />

    </div>
  )
}
