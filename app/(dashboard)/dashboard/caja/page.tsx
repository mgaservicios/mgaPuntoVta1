'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { DollarSign, LogIn, LogOut, Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { CajaSesion, CajaMovimiento, TipoMovCaja } from '@/types/ventas'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Dialogo apertura ──────────────────────────────────────────────────────────

function AbrirCajaDialog({ open, onClose, onOpened }: {
  open: boolean
  onClose: () => void
  onOpened: (s: CajaSesion) => void
}) {
  const [monto, setMonto] = useState('0')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!open) setMonto('0') }, [open])

  async function handleAbrir() {
    setSaving(true)
    const res = await fetch('/api/dashboard/caja/sesion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monto_apertura: monto }),
    })
    if (res.ok) {
      const data = await res.json()
      toast.success('Caja abierta')
      onOpened(data)
      onClose()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al abrir caja')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Abrir caja</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Monto de apertura ($)</Label>
          <Input
            type="number" step="0.01" min="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleAbrir} disabled={saving}>
            {saving ? 'Abriendo…' : 'Abrir caja'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Dialogo cierre ────────────────────────────────────────────────────────────

function CerrarCajaDialog({ open, sesionId, onClose, onClosed }: {
  open: boolean
  sesionId: number
  onClose: () => void
  onClosed: () => void
}) {
  const [monto, setMonto] = useState('0')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!open) { setMonto('0'); setObs('') } }, [open])

  async function handleCerrar() {
    setSaving(true)
    const res = await fetch(`/api/dashboard/caja/sesion/${sesionId}/cerrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monto_cierre: monto, observaciones: obs }),
    })
    if (res.ok) {
      toast.success('Caja cerrada')
      onClosed()
      onClose()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al cerrar caja')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Cerrar caja</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Monto contado en caja ($)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Observaciones</Label>
            <textarea
              rows={2}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Opcional"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleCerrar} disabled={saving} variant="destructive">
            {saving ? 'Cerrando…' : 'Cerrar caja'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Dialogo movimiento ────────────────────────────────────────────────────────

function MovimientoDialog({ open, sesionId, tipo, onClose, onSaved }: {
  open: boolean
  sesionId: number
  tipo: TipoMovCaja
  onClose: () => void
  onSaved: (m: CajaMovimiento) => void
}) {
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!open) { setConcepto(''); setMonto('') } }, [open])

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/dashboard/caja/sesion/${sesionId}/movimientos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, concepto, monto }),
    })
    if (res.ok) {
      const data = await res.json()
      toast.success(tipo === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado')
      onSaved(data)
      onClose()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al guardar')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{tipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Concepto *</Label>
            <Input
              placeholder="Ej: Fondo de cambio, pago a proveedor…"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Monto ($) *</Label>
            <Input
              type="number" step="0.01" min="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !concepto.trim() || !monto}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

interface MetodoMonto { metodo: string; label: string; monto: number }
interface ResumenData { ventas: MetodoMonto[]; ot: MetodoMonto[]; servicios: MetodoMonto[] }

function SinCaja() {
  return (
    <div className="flex items-center gap-3 text-gray-500 py-6">
      <DollarSign className="w-5 h-5 text-gray-300" />
      <span className="text-sm">No hay caja abierta. Abrí una para poder vender.</span>
    </div>
  )
}

export default function CajaPage() {
  const [sesion, setSesion] = useState<CajaSesion | null | undefined>(undefined)
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([])
  const [resumen, setResumen] = useState<ResumenData | null>(null)
  const [showAbrir, setShowAbrir] = useState(false)
  const [showCerrar, setShowCerrar] = useState(false)
  const [movDialog, setMovDialog] = useState<TipoMovCaja | null>(null)

  const loadSesion = useCallback(async () => {
    const res = await fetch('/api/dashboard/caja/sesion')
    const data = await res.json()
    setSesion(data)
    return data as CajaSesion | null
  }, [])

  const loadMovimientos = useCallback(async (id: number) => {
    const res = await fetch(`/api/dashboard/caja/sesion/${id}/movimientos`)
    const data = await res.json()
    setMovimientos(Array.isArray(data) ? data : [])
  }, [])

  const loadResumen = useCallback(async (id: number) => {
    const res = await fetch(`/api/dashboard/caja/sesion/${id}/resumen`)
    if (res.ok) setResumen(await res.json())
  }, [])

  useEffect(() => {
    loadSesion().then((s) => {
      if (s) {
        loadMovimientos(s.id)
        loadResumen(s.id)
      }
    })
  }, [loadSesion, loadMovimientos, loadResumen])

  function handleOpened(s: CajaSesion) {
    setSesion(s)
    setMovimientos([])
    setResumen(null)
    loadResumen(s.id)
  }

  function handleClosed() {
    loadSesion()
    setMovimientos([])
    setResumen(null)
  }

  function handleMovSaved(m: CajaMovimiento) {
    setMovimientos(prev => [m, ...prev])
    if (sesion) loadResumen(sesion.id)
  }

  if (sesion === undefined) return <div className="text-gray-400 text-sm">Cargando…</div>

  const estaAbierta = sesion?.estado === 'abierta'
  const ing = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0)
  const egr = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0)
  const totalCaja = Number(sesion?.monto_apertura ?? 0) + ing - egr

  return (
    <div className="max-w-2xl space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Caja</h2>
        {!estaAbierta ? (
          <Button onClick={() => setShowAbrir(true)}>
            <LogIn className="w-4 h-4 mr-2" />
            Abrir caja
          </Button>
        ) : (
          <Button variant="outline" className="text-red-500 hover:text-red-600" onClick={() => setShowCerrar(true)}>
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar caja
          </Button>
        )}
      </div>

      {/* Solapas */}
      <Tabs defaultValue="caja">
        <TabsList>
          <TabsTrigger value="caja">Caja</TabsTrigger>
          <TabsTrigger value="resumen">Resumen Caja</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
        </TabsList>

        {/* ── Solapa Caja ─────────────────────────────────────────── */}
        <TabsContent value="caja">
          <div className="bg-white rounded-xl border border-gray-200 p-5 mt-2">
            {!sesion ? <SinCaja /> : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Estado</p>
                  <Badge variant={estaAbierta ? 'default' : 'secondary'}>
                    {estaAbierta ? 'Abierta' : 'Cerrada'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Apertura</p>
                  <p className="text-sm font-medium">{formatDateTime(sesion.fecha_apertura)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Monto apertura</p>
                  <p className="text-sm font-medium">{formatARS(sesion.monto_apertura)}</p>
                </div>
                {estaAbierta && (
                  <>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Total caja</p>
                      <p className="text-base font-bold text-gray-900">{formatARS(totalCaja)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Total ingresos</p>
                      <p className="text-sm font-semibold text-green-600">{formatARS(ing)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Total egresos</p>
                      <p className="text-sm font-semibold text-red-500">{formatARS(egr)}</p>
                    </div>
                  </>
                )}
                {sesion.fecha_cierre && (
                  <>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Cierre</p>
                      <p className="text-sm font-medium">{formatDateTime(sesion.fecha_cierre)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Monto esperado</p>
                      <p className="text-sm font-medium">{formatARS(sesion.monto_esperado ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Monto contado</p>
                      <p className="text-sm font-medium">{formatARS(sesion.monto_cierre ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Diferencia</p>
                      <p className={`text-sm font-semibold ${(sesion.diferencia ?? 0) < 0 ? 'text-red-500' : (sesion.diferencia ?? 0) > 0 ? 'text-green-600' : ''}`}>
                        {formatARS(sesion.diferencia ?? 0)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Solapa Resumen Caja ──────────────────────────────────── */}
        <TabsContent value="resumen">
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mt-2">
            {!estaAbierta ? (
              <div className="p-5"><SinCaja /></div>
            ) : !resumen ? (
              <p className="px-4 py-4 text-sm text-gray-400">Cargando resumen…</p>
            ) : (() => {
              // Pivot: agrupar por forma de pago
              const toMap = (arr: MetodoMonto[]) => Object.fromEntries(arr.map(r => [r.metodo, r]))
              const vMap = toMap(resumen.ventas)
              const oMap = toMap(resumen.ot)
              const sMap = toMap(resumen.servicios)

              // Todos los métodos presentes, ordenados por monto total desc
              const allMetodos = Array.from(
                new Set([...resumen.ventas, ...resumen.ot, ...resumen.servicios].map(r => r.metodo))
              ).map(m => {
                const label = vMap[m]?.label ?? oMap[m]?.label ?? sMap[m]?.label ?? m
                const subtotal = (vMap[m]?.monto ?? 0) + (oMap[m]?.monto ?? 0) + (sMap[m]?.monto ?? 0)
                return { metodo: m, label, subtotal }
              }).sort((a, b) => b.subtotal - a.subtotal)

              const totalVentas    = resumen.ventas.reduce((s, r) => s + r.monto, 0)
              const totalOT        = resumen.ot.reduce((s, r) => s + r.monto, 0)
              const totalServicios = resumen.servicios.reduce((s, r) => s + r.monto, 0)
              const totalCobros    = totalVentas + totalOT + totalServicios

              if (allMetodos.length === 0) {
                return <p className="px-4 py-4 text-sm text-gray-400">Sin ventas ni cobros registrados en esta sesión.</p>
              }

              return (
                <>
                  {/* Total caja */}
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm font-semibold text-gray-800">Total caja</span>
                    <span className="text-base font-bold text-gray-900">{formatARS(totalCaja)}</span>
                  </div>

                  {/* Movimientos manuales de caja (ingresos que no son pagos + todos los egresos) */}
                  {(() => {
                    const isPaymentMov = (m: CajaMovimiento) =>
                      m.tipo === 'ingreso' && (
                        m.concepto.startsWith('Venta ') ||
                        m.concepto.startsWith('OT ') ||
                        m.concepto.startsWith('SV ') ||
                        /^OT-\d/.test(m.concepto) ||
                        /^SV-\d/.test(m.concepto)
                      )
                    const totalManualIng = movimientos
                      .filter(m => m.tipo === 'ingreso' && !isPaymentMov(m))
                      .reduce((s, m) => s + Number(m.monto), 0)
                    const totalEgr = movimientos
                      .filter(m => m.tipo === 'egreso')
                      .reduce((s, m) => s + Number(m.monto), 0)
                    const netManual = totalManualIng - totalEgr

                    return allMetodos.map(({ metodo, label, subtotal }) => {
                      const esEfectivo = metodo === 'EFECTIVO'
                      const efectivoTotal = esEfectivo ? subtotal + netManual : subtotal

                      return (
                        <div key={metodo} className="px-4 py-3 space-y-1.5">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                            <span className="text-sm font-bold text-gray-900">{formatARS(efectivoTotal)}</span>
                          </div>
                          {vMap[metodo] && (
                            <div className="flex justify-between text-sm pl-2">
                              <span className="text-gray-500">Ventas</span>
                              <span className="text-gray-700">{formatARS(vMap[metodo].monto)}</span>
                            </div>
                          )}
                          {oMap[metodo] && (
                            <div className="flex justify-between text-sm pl-2">
                              <span className="text-gray-500">Órdenes de trabajo</span>
                              <span className="text-gray-700">{formatARS(oMap[metodo].monto)}</span>
                            </div>
                          )}
                          {sMap[metodo] && (
                            <div className="flex justify-between text-sm pl-2">
                              <span className="text-gray-500">Servicios</span>
                              <span className="text-gray-700">{formatARS(sMap[metodo].monto)}</span>
                            </div>
                          )}
                          {esEfectivo && netManual !== 0 && (
                            <div className="flex justify-between text-sm pl-2">
                              <span className="text-gray-500">Mov. de caja</span>
                              <span className={netManual < 0 ? 'text-red-600' : 'text-gray-700'}>{formatARS(netManual)}</span>
                            </div>
                          )}
                        </div>
                      )
                    })
                  })()}

                  {/* Totales por categoría */}
                  <div className="px-4 py-3 space-y-1.5 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Totales por categoría</p>
                    {totalVentas > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Ventas</span>
                        <span className="font-medium text-gray-900">{formatARS(totalVentas)}</span>
                      </div>
                    )}
                    {totalOT > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Órdenes de trabajo</span>
                        <span className="font-medium text-gray-900">{formatARS(totalOT)}</span>
                      </div>
                    )}
                    {totalServicios > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Servicios</span>
                        <span className="font-medium text-gray-900">{formatARS(totalServicios)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1.5 mt-1">
                      <span>Total cobros</span>
                      <span>{formatARS(totalCobros)}</span>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </TabsContent>

        {/* ── Solapa Movimientos ───────────────────────────────────── */}
        <TabsContent value="movimientos">
          <div className="space-y-3 mt-2">
            {!estaAbierta ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5"><SinCaja /></div>
            ) : (
              <>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setMovDialog('ingreso')}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Ingreso
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600" onClick={() => setMovDialog('egreso')}>
                    <Minus className="w-3.5 h-3.5 mr-1" /> Egreso
                  </Button>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {movimientos.length === 0 ? (
                    <p className="text-center py-8 text-gray-400 text-sm">Sin movimientos en esta sesión</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {movimientos.map((m) => (
                        <div key={m.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{m.concepto}</p>
                            <p className="text-xs text-gray-400">{formatDateTime(m.created_at)}</p>
                          </div>
                          <span className={`text-sm font-semibold ${m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-500'}`}>
                            {m.tipo === 'ingreso' ? '+' : '-'}{formatARS(m.monto)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Diálogos */}
      <AbrirCajaDialog
        open={showAbrir}
        onClose={() => setShowAbrir(false)}
        onOpened={handleOpened}
      />
      {sesion && (
        <>
          <CerrarCajaDialog
            open={showCerrar}
            sesionId={sesion.id}
            onClose={() => setShowCerrar(false)}
            onClosed={handleClosed}
          />
          {movDialog && (
            <MovimientoDialog
              open
              sesionId={sesion.id}
              tipo={movDialog}
              onClose={() => setMovDialog(null)}
              onSaved={handleMovSaved}
            />
          )}
        </>
      )}
    </div>
  )
}
