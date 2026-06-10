'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, RefreshCw, CreditCard, Eye, Pencil, Trash2, Printer, CheckCircle2, PackageCheck } from 'lucide-react'
import { useSelectedSucursal } from '@/hooks/useSelectedSucursal'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  ESTADO_SERVICIO_LABELS, ESTADO_SERVICIO_BADGE, METODO_OPTICA_LABELS,
  TIPO_SERVICIO_LABELS, ESTADO_TIPO_SERVICIO_BADGE, ESTADO_TIPO_SERVICIO_LABELS,
  type EstadoServicio, type MetodoPagoOptica, type OpticaServicio, type EstadoTipoServicio,
} from '@/types/optica'

interface ServicioRow {
  id: number
  numero: string
  fecha: string
  fecha_prometida: string | null
  estado: EstadoServicio
  total: number
  clientes: { nombre: string } | null
  optica_servicio_pagos: { monto: number }[]
  optica_servicio_tipos: { tipo: string; estado?: string }[]
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const ESTADOS: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todos los estados' },
  ...Object.entries(ESTADO_SERVICIO_LABELS).map(([value, label]) => ({ value, label })),
]

const METODOS_PAGO: MetodoPagoOptica[] = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CUENTA_CORRIENTE', 'CHEQUE', 'OTRO']

// ── Vista rápida ──────────────────────────────────────────────────────────────

function ServicioViewDialog({ servicio, onClose, canEdit }: { servicio: OpticaServicio | null; onClose: () => void; canEdit: boolean }) {
  if (!servicio) return null
  const tipos = servicio.optica_servicio_tipos ?? []
  const pagos = servicio.optica_servicio_pagos ?? []
  const totalPagado = pagos.reduce((a, p) => a + p.monto, 0)
  const saldo = servicio.total - totalPagado

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono">{servicio.numero}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ESTADO_SERVICIO_BADGE[servicio.estado]}`}>
              {ESTADO_SERVICIO_LABELS[servicio.estado]}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Fecha</p>
              <p className="font-medium">{formatFecha(servicio.fecha)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Prometido para</p>
              <p className="font-medium">{servicio.fecha_prometida ? formatFecha(servicio.fecha_prometida) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Cliente</p>
              <p className="font-medium">{servicio.clientes?.nombre ?? '—'}</p>
            </div>
            {servicio.clientes?.telefono && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Teléfono</p>
                <p className="font-medium">{servicio.clientes.telefono}</p>
              </div>
            )}
            {servicio.detalle && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-0.5">Detalle del trabajo</p>
                <p className="text-gray-700 whitespace-pre-wrap">{servicio.detalle}</p>
              </div>
            )}
            {servicio.observaciones && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-0.5">Observaciones</p>
                <p className="text-gray-700">{servicio.observaciones}</p>
              </div>
            )}
          </div>

          {/* Tipos de reparación con estado */}
          {tipos.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Tipos de reparación</p>
              <div className="space-y-1.5">
                {tipos.map((t, i) => (
                  <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    ESTADO_TIPO_SERVICIO_BADGE[t.estado as EstadoTipoServicio] ?? 'bg-gray-50 border-gray-200'
                  }`}>
                    <span className={`inline-flex shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                      ESTADO_TIPO_SERVICIO_BADGE[t.estado as EstadoTipoServicio] ?? 'bg-gray-100 text-gray-600'
                    }`}>
                      {ESTADO_TIPO_SERVICIO_LABELS[t.estado as EstadoTipoServicio] ?? t.estado}
                    </span>
                    <span className="font-medium text-xs">
                      {TIPO_SERVICIO_LABELS[t.tipo as keyof typeof TIPO_SERVICIO_LABELS]}
                    </span>
                    {t.detalle && <span className="text-xs text-gray-500 flex-1 truncate">{t.detalle}</span>}
                    {t.precio > 0 && <span className="text-xs font-medium shrink-0">{formatARS(t.precio)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totales */}
          <div className="border-t pt-3 space-y-1.5">
            {servicio.costo_trabajo > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Costo de trabajo</span>
                <span>{formatARS(servicio.costo_trabajo)}</span>
              </div>
            )}
            {(servicio.descuento_pct > 0 || servicio.descuento_monto > 0) && (
              <div className="flex justify-between text-gray-500">
                <span>Descuento{servicio.descuento_pct > 0 ? ` (${servicio.descuento_pct}%)` : ''}</span>
                <span>-{formatARS(servicio.descuento_monto)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base pt-1 border-t">
              <span>Total</span>
              <span>{formatARS(servicio.total)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Pagado</span>
              <span className="text-green-600">{formatARS(totalPagado)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Saldo</span>
              <span className={saldo > 0.005 ? 'text-red-600' : 'text-green-600'}>{formatARS(saldo)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button variant="outline" className="gap-2" onClick={() => window.open(`/dashboard/optica/servicios/${servicio.id}/print`, '_blank')}>
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </Button>
          {canEdit && (
            <Link href={`/dashboard/optica/servicios/${servicio.id}`}>
              <Button className="gap-2">
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </Button>
            </Link>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function OpticaServiciosClient({ isAdmin }: { isAdmin: boolean }) {
  const { isHome } = useSelectedSucursal()
  const canWrite = isHome !== false
  const [servicios, setServicios] = useState<ServicioRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [q, setQ]                 = useState('')
  const [estado, setEstado]       = useState('todos')
  const [desde, setDesde]         = useState('')
  const [hasta, setHasta]         = useState('')

  const [viewServicio, setViewServicio]   = useState<OpticaServicio | null>(null)
  const [loadingView, setLoadingView]     = useState(false)
  const [deletingServicio, setDeletingServicio] = useState<ServicioRow | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const [pagarServicio, setPagarServicio] = useState<ServicioRow | null>(null)
  const [pagoMetodo, setPagoMetodo]       = useState<MetodoPagoOptica>('EFECTIVO')
  const [pagoMonto, setPagoMonto]         = useState('')
  const [savingPago, setSavingPago]       = useState(false)
  const [changingEstado, setChangingEstado] = useState<number | null>(null)

  const fetchServicios = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (estado !== 'todos') params.set('estado', estado)
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)

    try {
      const res  = await fetch(`/api/dashboard/optica/servicios?${params}`)
      const data = await res.json()
      setServicios(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Error de red al cargar servicios')
    } finally {
      setLoading(false)
    }
  }, [q, estado, desde, hasta])

  useEffect(() => {
    const t = setTimeout(fetchServicios, 300)
    return () => clearTimeout(t)
  }, [fetchServicios])

  async function handleVerServicio(id: number) {
    setLoadingView(true)
    try {
      const res  = await fetch(`/api/dashboard/optica/servicios/${id}`)
      const json = await res.json()
      if (!res.ok) { toast.error(json?.error ?? `Error ${res.status} al cargar el servicio`); return }
      setViewServicio(json)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setLoadingView(false)
    }
  }

  async function handlePagoRapido() {
    if (!pagarServicio) return
    const monto = parseFloat(pagoMonto)
    if (isNaN(monto) || monto <= 0) { toast.error('Ingresá un monto válido'); return }
    setSavingPago(true)
    const res = await fetch(`/api/dashboard/optica/servicios/${pagarServicio.id}/pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metodo: pagoMetodo, monto, concepto: 'PAGO' }),
    })
    setSavingPago(false)
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error al registrar pago'); return }
    toast.success('Pago registrado')
    setPagarServicio(null)
    fetchServicios()
  }

  async function handleEliminar() {
    if (!deletingServicio) return
    setConfirmingDelete(true)
    const res = await fetch(`/api/dashboard/optica/servicios/${deletingServicio.id}`, { method: 'DELETE' })
    setConfirmingDelete(false)
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error al eliminar'); setDeletingServicio(null); return }
    toast.success(`Servicio ${deletingServicio.numero} eliminado`)
    setDeletingServicio(null)
    fetchServicios()
  }

  async function handleCambiarEstado(s: ServicioRow, estado: 'terminado' | 'entregado') {
    setChangingEstado(s.id)
    try {
      const res = await fetch(`/api/dashboard/optica/servicios/${s.id}/cambiar-estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? `Error al cambiar estado`)
        return
      }
      const label = estado === 'terminado' ? 'Terminado' : 'Entregado'
      toast.success(`${s.numero} marcado como ${label}`)
      fetchServicios()
    } catch {
      toast.error('Error de red')
    } finally {
      setChangingEstado(null)
    }
  }

  function abrirPago(s: ServicioRow) {
    const pagado = (s.optica_servicio_pagos ?? []).reduce((a, p) => a + p.monto, 0)
    const saldo  = s.total - pagado
    setPagoMonto(saldo > 0.005 ? saldo.toFixed(2) : '')
    setPagoMetodo('EFECTIVO')
    setPagarServicio(s)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Servicios óptica</h1>
          <p className="text-sm text-gray-500">{servicios.length} resultado{servicios.length !== 1 ? 's' : ''}</p>
        </div>
        {canWrite && (
          <Link href="/dashboard/optica/servicios/nueva">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo servicio
            </Button>
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 px-6 py-3 bg-gray-50 border-b">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por número o cliente..."
            className="pl-9 h-9"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <Select value={estado} onValueChange={v => setEstado(v ?? 'todos')}>
          <SelectTrigger className="w-52 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ESTADOS.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="w-38 h-9" value={desde} onChange={e => setDesde(e.target.value)} />
        <Input type="date" className="w-38 h-9" value={hasta} onChange={e => setHasta(e.target.value)} />
        <Button variant="outline" size="sm" onClick={fetchServicios} className="h-9">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : servicios.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium">Sin servicios</p>
            <p className="text-sm mt-1">Creá el primero con el botón &quot;Nuevo servicio&quot;</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                <th className="pb-2 pr-4 font-medium">N°</th>
                <th className="pb-2 pr-4 font-medium">Fecha</th>
                <th className="pb-2 pr-4 font-medium">Cliente</th>
                <th className="pb-2 pr-4 font-medium">Prometido</th>
                <th className="pb-2 pr-4 font-medium">Tipos</th>
                <th className="pb-2 pr-4 font-medium">Estado</th>
                <th className="pb-2 pr-4 font-medium text-right">Total</th>
                <th className="pb-2 pr-4 font-medium text-right">Saldo</th>
                <th className="pb-2 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {servicios.map(s => {
                const pagado = (s.optica_servicio_pagos ?? []).reduce((a, p) => a + p.monto, 0)
                const saldo  = s.total - pagado
                const tipos  = s.optica_servicio_tipos ?? []

                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="font-mono font-medium text-gray-900">{s.numero}</span>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{formatFecha(s.fecha)}</td>
                    <td className="py-3 pr-4 font-medium">
                      {s.clientes?.nombre ?? <span className="text-gray-400 italic">Sin cliente</span>}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {s.fecha_prometida ? formatFecha(s.fecha_prometida) : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {tipos.slice(0, 2).map((t, i) => (
                          <span key={i} className="inline-flex text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {TIPO_SERVICIO_LABELS[t.tipo as keyof typeof TIPO_SERVICIO_LABELS]}
                          </span>
                        ))}
                        {tipos.length > 2 && (
                          <span className="inline-flex text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            +{tipos.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ESTADO_SERVICIO_BADGE[s.estado]}`}>
                        {ESTADO_SERVICIO_LABELS[s.estado]}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-medium">{formatARS(s.total)}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className={saldo > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                        {formatARS(saldo)}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => handleVerServicio(s.id)}
                          title="Ver detalle"
                          disabled={loadingView}
                          className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.open(`/dashboard/optica/servicios/${s.id}/print`, '_blank')}
                          title="Imprimir / PDF"
                          className="p-1.5 rounded-md text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {canWrite && (
                          <Link
                            href={`/dashboard/optica/servicios/${s.id}`}
                            title="Editar"
                            className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                        )}
                        {canWrite && ['pendiente', 'en_proceso'].includes(s.estado) && (
                          <button
                            onClick={() => handleCambiarEstado(s, 'terminado')}
                            title="Marcar como terminado"
                            disabled={changingEstado === s.id}
                            className="p-1.5 rounded-md text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {canWrite && s.estado === 'terminado' && (
                          <button
                            onClick={() => handleCambiarEstado(s, 'entregado')}
                            title="Marcar como entregado"
                            disabled={changingEstado === s.id}
                            className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40"
                          >
                            <PackageCheck className="w-4 h-4" />
                          </button>
                        )}
                        {canWrite && saldo > 0.005 && !['anulado', 'entregado'].includes(s.estado) && (
                          <button
                            onClick={() => abrirPago(s)}
                            title="Registrar pago"
                            className="p-1.5 rounded-md text-green-600 hover:bg-green-50 transition-colors"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && canWrite
                          && (s.optica_servicio_pagos ?? []).length === 0
                          && (
                          <button
                            onClick={() => setDeletingServicio(s)}
                            title="Eliminar servicio"
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal vista completa */}
      <ServicioViewDialog servicio={viewServicio} onClose={() => setViewServicio(null)} canEdit={canWrite} />

      {/* Confirmar eliminación */}
      <Dialog open={!!deletingServicio} onOpenChange={open => { if (!open) setDeletingServicio(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar servicio — {deletingServicio?.numero}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-1">
            Esta acción es irreversible. ¿Confirmás que querés eliminar el servicio <span className="font-mono font-medium">{deletingServicio?.numero}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingServicio(null)} disabled={confirmingDelete}>Cancelar</Button>
            <Button variant="destructive" onClick={handleEliminar} disabled={confirmingDelete}>
              {confirmingDelete ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal pago rápido */}
      <Dialog open={!!pagarServicio} onOpenChange={open => { if (!open) setPagarServicio(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar pago — {pagarServicio?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="mb-1.5 block text-sm">Método de pago</Label>
              <select
                className="w-full h-9 text-sm border border-input rounded-md px-2 bg-white"
                value={pagoMetodo}
                onChange={e => setPagoMetodo(e.target.value as MetodoPagoOptica)}
              >
                {METODOS_PAGO.map(m => <option key={m} value={m}>{METODO_OPTICA_LABELS[m]}</option>)}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Monto</Label>
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={pagoMonto}
                onChange={e => setPagoMonto(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagarServicio(null)}>Cancelar</Button>
            <Button onClick={handlePagoRapido} disabled={savingPago || !pagoMonto}>
              {savingPago ? 'Registrando…' : 'Confirmar pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
