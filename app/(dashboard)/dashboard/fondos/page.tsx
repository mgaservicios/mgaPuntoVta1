'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { DollarSign, LogOut, Plus, Minus, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { CajaSesion, CajaMovimiento, TipoMovCaja } from '@/types/ventas'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useVendedores, type VendedorOption } from '@/hooks/useVendedores'
import { usePermissions } from '@/components/PermissionsProvider'

const CONCEPTOS_CAJA = [
  'Apertura',
  'Gastos',
  'Retiro',
  'Fondo de cambio',
  'Pago a proveedor',
  'Ingreso',
  'Otros',
]

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Dialogo cierre ────────────────────────────────────────────────────────────

// ── Dialogo apertura ──────────────────────────────────────────────────────────

function AbrirCajaDialog({ open, saving, onClose, onConfirm }: {
  open: boolean
  saving: boolean
  onClose: () => void
  onConfirm: (monto: number, vendedorId: number | null) => void
}) {
  const [monto, setMonto] = useState('0')
  const [vendedorId, setVendedorId] = useState<number | null>(null)
  const vendedores = useVendedores()

  useEffect(() => { if (open) { setMonto('0'); setVendedorId(null) } }, [open])

  function handleConfirm() {
    onConfirm(parseFloat(monto) || 0, vendedorId)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Abrir caja</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Vendedor</Label>
            <Select value={vendedorId?.toString() ?? ''} onValueChange={v => setVendedorId(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar vendedor…" /></SelectTrigger>
              <SelectContent>
                {vendedores.map((v: VendedorOption) => (
                  <SelectItem key={v.id} value={v.id.toString()} label={v.nombre}>{v.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Monto de apertura ($)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
            <p className="text-xs text-gray-400">Ingresá el efectivo disponible al abrir. Si no tenés fondo, dejá en 0.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? 'Abriendo…' : 'Abrir caja'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function toDatetimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function CerrarCajaDialog({ open, sesionId, onClose, onClosed }: {
  open: boolean
  sesionId: number
  onClose: () => void
  onClosed: () => void
}) {
  const [monto, setMonto] = useState('0')
  const [fecha, setFecha] = useState(() => toDatetimeLocal(new Date()))
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) { setMonto('0'); setObs('') }
    if (open) setFecha(toDatetimeLocal(new Date()))
  }, [open])

  async function handleCerrar() {
    setSaving(true)
    const res = await fetch(`/api/dashboard/caja/sesion/${sesionId}/cerrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monto_cierre: monto, fecha_cierre: fecha, observaciones: obs }),
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
            <Label>Fecha y hora de cierre</Label>
            <Input
              type="datetime-local"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
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

// ── Dialogo continuar caja (cerrar y abrir nueva) ──────────────────────────

function ContinuarCajaDialog({ open, sesionAnterior, onClose, onConfirm }: {
  open: boolean
  sesionAnterior: CajaSesion | null
  onClose: () => void
  onConfirm: (montoCierre: number, observaciones: string) => void
}) {
  const [monto, setMonto] = useState('0')
  const [obs, setObs] = useState('')

  useEffect(() => {
    if (open) {
      setMonto(sesionAnterior?.monto_apertura?.toString() ?? '0')
      setObs('')
    }
  }, [open, sesionAnterior])

  function handleConfirm() {
    onConfirm(parseFloat(monto) || 0, obs)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cerrar y abrir nueva caja</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Se cerrará la sesión del día anterior y se abrirá una nueva con el monto que indiques.
          </p>
          <div className="space-y-1">
            <Label>Monto contado en caja ($)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-gray-400">
              Monto esperado: {formatARS(sesionAnterior?.monto_apertura ?? 0)}
            </p>
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
          <Button onClick={handleConfirm}>
            Cerrar y abrir nueva
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
  const [tipoConcepto, setTipoConcepto] = useState(CONCEPTOS_CAJA[0])
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [vendedorId, setVendedorId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const vendedores = useVendedores()

  useEffect(() => {
    if (!open) { setTipoConcepto(CONCEPTOS_CAJA[0]); setConcepto(''); setMonto(''); setVendedorId(null) }
  }, [open])

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/dashboard/caja/sesion/${sesionId}/movimientos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, tipo_concepto: tipoConcepto, concepto, monto, vendedor_id: vendedorId }),
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
            <Label>Vendedor</Label>
            <Select value={vendedorId?.toString() ?? ''} onValueChange={v => setVendedorId(Number(v))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar vendedor…" /></SelectTrigger>
              <SelectContent>
                {vendedores.map((v: VendedorOption) => (
                  <SelectItem key={v.id} value={v.id.toString()} label={v.nombre}>{v.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Tipo de concepto *</Label>
            <select
              autoFocus
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={tipoConcepto}
              onChange={(e) => setTipoConcepto(e.target.value)}
            >
              {CONCEPTOS_CAJA.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Concepto / Detalle</Label>
            <Input
              placeholder="Descripción del movimiento (opcional)"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
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
          <Button onClick={handleSave} disabled={saving || !monto}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

function SinCaja() {
  return (
    <div className="flex items-center gap-3 text-gray-500 py-6">
      <DollarSign className="w-5 h-5 text-gray-300" />
      <span className="text-sm">Caja cerrada. Iniciá una nueva sesión para operar.</span>
    </div>
  )
}

// ── Tipos resumen ─────────────────────────────────────────────────────────────

interface MetodoMonto { metodo: string; label: string; monto: number }
interface ResumenData {
  ventas: MetodoMonto[]
  ordenes: MetodoMonto[]
  ot: MetodoMonto[]
  servicios: MetodoMonto[]
  apertura: number
  manualIng: number
  manualEgr: number
}

async function abrirCaja(monto_apertura: number, vendedor_id: number | null, sesion_anterior_id?: number | null): Promise<{ data: CajaSesion | null; error: string | null }> {
  const res = await fetch('/api/dashboard/caja/sesion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monto_apertura, vendedor_id, sesion_anterior_id }),
  })
  if (res.ok) return { data: await res.json(), error: null }
  const body = await res.json().catch(() => ({}))
  return { data: null, error: body.error ?? `Error ${res.status}` }
}

export default function CajaPage() {
  const { can } = usePermissions()
  const [sucursalNombre, setSucursalNombre] = useState<string | null>(null)
  const [sesion, setSesion] = useState<CajaSesion | null | undefined>(undefined)
  const [sesionAnterior, setSesionAnterior] = useState<CajaSesion | null>(null)
  const [isHomeCaja, setIsHomeCaja] = useState(true)
  const [movimientos, setMovimientos] = useState<CajaMovimiento[]>([])
  const [resumen, setResumen] = useState<ResumenData | null>(null)
  const [showCerrar, setShowCerrar] = useState(false)
  const [showAbrir, setShowAbrir] = useState(false)
  const [movDialog, setMovDialog] = useState<TipoMovCaja | null>(null)
  const [openingCaja, setOpeningCaja] = useState(false)
  const [continuandoCaja, setContinuandoCaja] = useState(false)
  const [showContinuarDialog, setShowContinuarDialog] = useState(false)

  const loadMovimientos = useCallback(async (id: number) => {
    const res = await fetch(`/api/dashboard/caja/sesion/${id}/movimientos`)
    const data = await res.json()
    setMovimientos(Array.isArray(data) ? data : [])
  }, [])

  const loadResumen = useCallback(async (id: number) => {
    const res = await fetch(`/api/dashboard/caja/sesion/${id}/resumen`)
    if (res.ok) setResumen(await res.json())
  }, [])

  // Auto-open: on mount, get or create an active session (only for home sucursal)
  useEffect(() => {
    async function init() {
      const res = await fetch('/api/dashboard/caja/sesion')
      const data: { sesion: CajaSesion | null; sesion_anterior: CajaSesion | null; isHome: boolean; sucursalNombre: string | null } = await res.json()
      setIsHomeCaja(data.isHome ?? true)
      setSucursalNombre(data.sucursalNombre ?? null)
      setSesionAnterior(data.sesion_anterior ?? null)
      const s = data.sesion
      setSesion(s)
      if (s) {
        loadMovimientos(s.id)
        loadResumen(s.id)
      } else if (data.sesion_anterior) {
        loadMovimientos(data.sesion_anterior.id)
        loadResumen(data.sesion_anterior.id)
      }
    }
    init()
  }, [loadMovimientos, loadResumen])

  async function handleAbrirConMonto(monto: number, vendedorId: number | null) {
    setOpeningCaja(true)
    const { data: s, error } = await abrirCaja(monto, vendedorId, sesionAnterior?.id)
    if (s) {
      setSesion(s)
      setSesionAnterior(null)
      setMovimientos([])
      setResumen(null)
      if (monto > 0) loadMovimientos(s.id)
      loadResumen(s.id)
      toast.success('Caja abierta')
    } else {
      toast.error(error ?? 'No se pudo abrir la caja')
    }
    setOpeningCaja(false)
    setShowAbrir(false)
  }

  async function handleContinuar(accion: 'continuar' | 'cerrar_y_abrir', montoCierre?: number, observaciones?: string) {
    if (!sesionAnterior) return
    setContinuandoCaja(true)
    const res = await fetch(`/api/dashboard/caja/sesion/${sesionAnterior.id}/continuar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion,
        monto_cierre: montoCierre,
        observaciones,
        fecha_hora_cierre: new Date().toISOString(),
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setSesion(data.sesion_nueva)
      setSesionAnterior(null)
      setMovimientos([])
      setResumen(null)
      loadMovimientos(data.sesion_nueva.id)
      loadResumen(data.sesion_nueva.id)
      toast.success(accion === 'continuar' ? 'Caja continuada' : 'Caja cerrada y nueva sesión abierta')
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al procesar')
    }
    setContinuandoCaja(false)
    setShowContinuarDialog(false)
  }

  function handleClosed() {
    fetch('/api/dashboard/caja/sesion').then(r => r.json()).then((data: { sesion: CajaSesion | null; sesion_anterior: CajaSesion | null; isHome: boolean; sucursalNombre: string | null }) => {
      setSesion(data.sesion)
      setSesionAnterior(data.sesion_anterior ?? null)
      setIsHomeCaja(data.isHome ?? true)
      setSucursalNombre(data.sucursalNombre ?? null)
      setMovimientos([])
      setResumen(null)
      const s = data.sesion
      if (s) {
        loadMovimientos(s.id)
        loadResumen(s.id)
      } else if (data.sesion_anterior) {
        loadMovimientos(data.sesion_anterior.id)
        loadResumen(data.sesion_anterior.id)
      }
    })
  }

  function handleMovSaved(m: CajaMovimiento) {
    setMovimientos(prev => [m, ...prev])
    if (sesion) loadResumen(sesion.id)
  }

  if (sesion === undefined) return <div className="text-gray-400 text-sm">Iniciando caja…</div>

  // Usar sesión actual si existe, si no la anterior (para mostrar datos)
  const displaySesion = sesion ?? sesionAnterior

  const estaAbierta = sesion?.estado === 'abierta'
  // Excluir Apertura de ingresos: ya está contada en monto_apertura
  const ing = movimientos.filter(m => m.tipo === 'ingreso' && m.tipo_concepto !== 'Apertura').reduce((s, m) => s + Number(m.monto), 0)
  const egr = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto), 0)
  const totalCaja = Number(displaySesion?.monto_apertura ?? 0) + ing - egr

  return (
    <div className="max-w-2xl space-y-4">

      {/* Banner sesión anterior */}
      {sesionAnterior && isHomeCaja && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                Caja abierta del día anterior
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Fecha: {new Date(sesionAnterior.fecha_apertura).toLocaleDateString('es-AR')} —
                Monto actual: {formatARS(sesionAnterior.monto_apertura)}
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleContinuar('continuar')}
                  disabled={continuandoCaja}
                >
                  {continuandoCaja ? 'Procesando…' : 'Continuar caja'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => setShowContinuarDialog(true)}
                  disabled={continuandoCaja}
                >
                  Cerrar y abrir nueva
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold text-gray-800">Caja</h2>
          {sucursalNombre && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200 shrink-0 hidden sm:inline">
              {sucursalNombre}
            </span>
          )}
          {!isHomeCaja && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shrink-0 hidden sm:inline">
              Solo lectura
            </span>
          )}
        </div>
        {isHomeCaja && (
          estaAbierta ? (
            can('fondos.caja.cerrar') && (
              <Button variant="outline" className="text-red-500 hover:text-red-600" onClick={() => setShowCerrar(true)}>
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar caja
              </Button>
            )
          ) : sesion !== undefined ? (
            can('fondos.caja.abrir') && (
              <Button onClick={() => setShowAbrir(true)} disabled={openingCaja}>
                Nueva sesión
              </Button>
            )
          ) : null
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
            {!displaySesion ? <SinCaja /> : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Estado</p>
                  <Badge variant={estaAbierta ? 'default' : 'secondary'}>
                    {estaAbierta ? 'Abierta' : 'Cerrada'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Apertura</p>
                  <p className="text-sm font-medium">{formatDateTime(displaySesion.fecha_apertura)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Monto apertura</p>
                  <p className="text-sm font-medium">{formatARS(displaySesion.monto_apertura)}</p>
                </div>
                {(estaAbierta || !sesion) && (
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
                {displaySesion.fecha_cierre && (
                  <>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Cierre</p>
                      <p className="text-sm font-medium">{formatDateTime(displaySesion.fecha_cierre)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Monto esperado</p>
                      <p className="text-sm font-medium">{formatARS(displaySesion.monto_esperado ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Monto contado</p>
                      <p className="text-sm font-medium">{formatARS(displaySesion.monto_cierre ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Diferencia</p>
                      <p className={`text-sm font-semibold ${(displaySesion.diferencia ?? 0) < 0 ? 'text-red-500' : (displaySesion.diferencia ?? 0) > 0 ? 'text-green-600' : ''}`}>
                        {formatARS(displaySesion.diferencia ?? 0)}
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
            {!displaySesion ? (
              <div className="p-5"><SinCaja /></div>
            ) : !resumen ? (
              <p className="px-4 py-4 text-sm text-gray-400">Cargando resumen…</p>
            ) : (() => {
              const toMap = (arr: MetodoMonto[]) => Object.fromEntries(arr.map(r => [r.metodo, r]))
              const vMap  = toMap(resumen.ventas)
              const ordMap = toMap(resumen.ordenes)
              const oMap  = toMap(resumen.ot)
              const sMap  = toMap(resumen.servicios)

              const METODO_LABELS: Record<string, string> = {
                EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia',
                TARJETA_DEBITO: 'Tarjeta débito', TARJETA_CREDITO: 'Tarjeta crédito',
                CHEQUE: 'Cheque', OTRO: 'Otro', CUENTA_CORRIENTE: 'Cuenta corriente',
              }

              // Todos los metodos presentes (incluyendo EFECTIVO si hay mov. manuales)
              const metodoSet = new Set([
                ...resumen.ventas, ...resumen.ordenes, ...resumen.ot, ...resumen.servicios
              ].map(r => r.metodo))
              if (resumen.apertura > 0 || resumen.manualIng > 0 || resumen.manualEgr > 0) metodoSet.add('EFECTIVO')

              const allMetodos = Array.from(metodoSet).map(m => {
                const vM = vMap[m]?.monto ?? 0
                const oM = ordMap[m]?.monto ?? 0
                const otM = oMap[m]?.monto ?? 0
                const sM = sMap[m]?.monto ?? 0
                const apertura = m === 'EFECTIVO' ? resumen.apertura : 0
                const manualNet = m === 'EFECTIVO' ? resumen.manualIng - resumen.manualEgr : 0
                return {
                  metodo: m,
                  label: METODO_LABELS[m] ?? m,
                  ventas: vM, ordenes: oM, ot: otM, servicios: sM, apertura, manualNet,
                  total: vM + oM + otM + sM + apertura + manualNet,
                }
              }).sort((a, b) => b.total - a.total)

              const totalVentas   = resumen.ventas.reduce((s, r) => s + r.monto, 0)
              const totalOrdenes  = resumen.ordenes.reduce((s, r) => s + r.monto, 0)
              const totalOT       = resumen.ot.reduce((s, r) => s + r.monto, 0)
              const totalSv       = resumen.servicios.reduce((s, r) => s + r.monto, 0)
              const netManual     = resumen.manualIng - resumen.manualEgr
              const grandTotal    = totalVentas + totalOrdenes + totalOT + totalSv + resumen.apertura + netManual

              const hasData = grandTotal !== 0 || allMetodos.length > 0

              if (!hasData) {
                return <p className="px-4 py-4 text-sm text-gray-400">Sin movimientos registrados en esta sesión.</p>
              }

              const Row = ({ label, value, color }: { label: string; value: number; color?: string }) =>
                value !== 0 ? (
                  <div className="flex justify-between text-sm pl-3">
                    <span className="text-gray-500">{label}</span>
                    <span className={color ?? 'text-gray-700'}>{formatARS(value)}</span>
                  </div>
                ) : null

              return (
                <>
                  {/* Total caja */}
                  <div className="flex justify-between items-center px-4 py-3 bg-gray-50">
                    <span className="text-sm font-semibold text-gray-700">Total caja</span>
                    <span className="text-base font-bold text-gray-900">{formatARS(totalCaja)}</span>
                  </div>

                  {/* Un bloque por forma de pago */}
                  {allMetodos.map(({ metodo, label, ventas: v, ordenes: o, ot, servicios: s, apertura: ap, manualNet, total }) => (
                    <div key={metodo} className="px-4 py-3 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                        <span className="text-sm font-bold text-gray-900">{formatARS(total)}</span>
                      </div>
                      {metodo === 'EFECTIVO' && ap > 0 && (
                        <Row label="Apertura"            value={ap} />
                      )}
                      <Row label="Ventas POS"            value={v} />
                      <Row label="Órdenes de venta"      value={o} />
                      <Row label="Órdenes de trabajo"    value={ot} />
                      <Row label="Servicios"             value={s} />
                      {metodo === 'EFECTIVO' && resumen.manualIng > 0 && (
                        <Row label="Ingresos de caja"    value={resumen.manualIng} />
                      )}
                      {metodo === 'EFECTIVO' && resumen.manualEgr > 0 && (
                        <Row label="Egresos de caja"     value={-resumen.manualEgr} color="text-red-600" />
                      )}
                    </div>
                  ))}

                  {/* Totales por categoría */}
                  <div className="px-4 py-3 space-y-1.5 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Totales por categoría</p>
                    {resumen.apertura  > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Apertura</span><span className="font-medium">{formatARS(resumen.apertura)}</span></div>}
                    {totalVentas  > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Ventas POS</span><span className="font-medium">{formatARS(totalVentas)}</span></div>}
                    {totalOrdenes > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Órdenes de venta</span><span className="font-medium">{formatARS(totalOrdenes)}</span></div>}
                    {totalOT      > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Órdenes de trabajo</span><span className="font-medium">{formatARS(totalOT)}</span></div>}
                    {totalSv      > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Servicios</span><span className="font-medium">{formatARS(totalSv)}</span></div>}
                    {resumen.manualIng > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Ingresos de caja</span><span className="font-medium text-green-600">{formatARS(resumen.manualIng)}</span></div>}
                    {resumen.manualEgr > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Egresos de caja</span><span className="font-medium text-red-500">-{formatARS(resumen.manualEgr)}</span></div>}
                    <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1.5 mt-1">
                      <span>Total</span>
                      <span>{formatARS(grandTotal)}</span>
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
            {!displaySesion ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5"><SinCaja /></div>
            ) : (
              <>
                {isHomeCaja && can('fondos.caja.movimiento') && (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setMovDialog('ingreso')}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Ingreso
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600" onClick={() => setMovDialog('egreso')}>
                      <Minus className="w-3.5 h-3.5 mr-1" /> Egreso
                    </Button>
                  </div>
                )}

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {movimientos.length === 0 ? (
                    <p className="text-center py-8 text-gray-400 text-sm">Sin movimientos en esta sesión</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {movimientos.map((m) => (
                        <div key={m.id} className="flex items-center justify-between px-4 py-3 gap-3">
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
                              {!m.tipo_concepto && !m.concepto && (
                                <p className="text-sm text-gray-400 italic">Sin descripción</p>
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
                  )}
                </div>
              </>
            )}
          </div>
        </TabsContent>

      </Tabs>

      {/* Diálogos — solo disponibles para la sucursal logueada */}
      {isHomeCaja && (
        <>
          <AbrirCajaDialog
            open={showAbrir}
            saving={openingCaja}
            onClose={() => setShowAbrir(false)}
            onConfirm={handleAbrirConMonto}
          />
          <ContinuarCajaDialog
            open={showContinuarDialog}
            sesionAnterior={sesionAnterior}
            onClose={() => setShowContinuarDialog(false)}
            onConfirm={(monto, obs) => handleContinuar('cerrar_y_abrir', monto, obs)}
          />
        </>
      )}
      {sesion && isHomeCaja && (
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
