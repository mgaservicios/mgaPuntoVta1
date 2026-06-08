'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, RefreshCw, CreditCard, Eye, Pencil, Trash2, Printer } from 'lucide-react'
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
  ESTADO_OPTICA_LABELS, METODO_OPTICA_LABELS, TIPO_ITEM_LABELS, USO_ITEM_LABELS,
  type EstadoOpticaOrden, type MetodoPagoOptica, type OpticaOrden,
} from '@/types/optica'

interface OrdenRow {
  id: number
  numero: string
  fecha: string
  fecha_prometida: string | null
  estado: EstadoOpticaOrden
  total: number
  clientes: { nombre: string } | null
  optica_orden_pagos: { monto: number }[]
  optica_orden_tareas: { id: number; estado: string }[]
}

const ESTADO_BADGE: Record<EstadoOpticaOrden, string> = {
  pendiente: 'bg-slate-100 text-slate-700',
  en_proceso: 'bg-blue-100 text-blue-700',
  en_laboratorio: 'bg-orange-100 text-orange-700',
  terminado: 'bg-green-100 text-green-700',
  entregado: 'bg-emerald-100 text-emerald-700',
  anulado: 'bg-red-100 text-red-700',
}

const TAREA_BADGE: Record<string, string> = {
  en_proceso: 'bg-blue-100 text-blue-700',
  en_laboratorio: 'bg-orange-100 text-orange-700',
  terminada: 'bg-green-100 text-green-700',
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmt(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  return v > 0 ? `+${v}` : String(v)
}

function hasGraduacion(o: OpticaOrden) {
  return [o.lejos_od_esfera, o.lejos_oi_esfera, o.cerca_od_esfera, o.cerca_oi_esfera, o.adicion].some(v => v !== null)
}

const ESTADOS: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todos los estados' },
  ...Object.entries(ESTADO_OPTICA_LABELS).map(([value, label]) => ({ value, label })),
]

const METODOS_PAGO: MetodoPagoOptica[] = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CUENTA_CORRIENTE', 'CHEQUE', 'OTRO']

// ── Vista completa de la OT ──────────────────────────────────────────────────

function OrdenViewDialog({ orden, onClose, canEdit }: { orden: OpticaOrden | null; onClose: () => void; canEdit: boolean }) {
  if (!orden) return null
  const items = orden.optica_orden_items ?? []
  const tareas = orden.optica_orden_tareas ?? []
  const pagos = orden.optica_orden_pagos ?? []
  const totalPagado = pagos.reduce((a, p) => a + p.monto, 0)
  const saldo = orden.total - totalPagado

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono">{orden.numero}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              ESTADO_BADGE[orden.estado]
            }`}>
              {ESTADO_OPTICA_LABELS[orden.estado]}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          {/* Info general */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Fecha</p>
              <p className="font-medium">{formatFecha(orden.fecha)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Prometido para</p>
              <p className="font-medium">
                {orden.fecha_prometida ? formatFecha(orden.fecha_prometida) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Cliente</p>
              <p className="font-medium">{orden.clientes?.nombre ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Médico</p>
              <p className="font-medium">
                {orden.optica_medicos?.nombre ?? orden.medico_nombre ?? '—'}
              </p>
            </div>
            {orden.observaciones && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-0.5">Observaciones</p>
                <p className="text-gray-700">{orden.observaciones}</p>
              </div>
            )}
          </div>

          {/* Graduación */}
          {hasGraduacion(orden) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Graduación</p>
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-500"></th>
                    <th className="text-center px-2 py-1.5 font-medium text-gray-500">Esfera</th>
                    <th className="text-center px-2 py-1.5 font-medium text-gray-500">Cilindro</th>
                    <th className="text-center px-2 py-1.5 font-medium text-gray-500">Eje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { label: 'Lejos OD', esf: orden.lejos_od_esfera, cil: orden.lejos_od_cilindro, eje: orden.lejos_od_eje },
                    { label: 'Lejos OI', esf: orden.lejos_oi_esfera, cil: orden.lejos_oi_cilindro, eje: orden.lejos_oi_eje },
                    { label: 'Cerca OD', esf: orden.cerca_od_esfera, cil: orden.cerca_od_cilindro, eje: orden.cerca_od_eje },
                    { label: 'Cerca OI', esf: orden.cerca_oi_esfera, cil: orden.cerca_oi_cilindro, eje: orden.cerca_oi_eje },
                  ].map(row => (
                    <tr key={row.label}>
                      <td className="px-3 py-1.5 font-medium text-gray-600">{row.label}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{fmt(row.esf)}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{fmt(row.cil)}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{row.eje ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(orden.adicion !== null || orden.dp !== null) && (
                <div className="flex gap-6 mt-2 px-1">
                  {orden.adicion !== null && (
                    <span><span className="text-gray-500">Adición:</span> <span className="font-mono font-medium">{fmt(orden.adicion)}</span></span>
                  )}
                  {orden.dp !== null && (
                    <span><span className="text-gray-500">DP:</span> <span className="font-mono font-medium">{orden.dp}</span></span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Artículos */}
          {items.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Artículos</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="text-left pb-1.5 font-medium">Artículo</th>
                    <th className="text-left pb-1.5 font-medium">Tipo / Uso</th>
                    <th className="text-center pb-1.5 font-medium">Cant.</th>
                    <th className="text-right pb-1.5 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className="py-1.5 pr-2 font-medium">
                        {item.nombre}
                        {item.notas && <span className="block text-gray-400 font-normal">{item.notas}</span>}
                      </td>
                      <td className="py-1.5 pr-2 text-gray-500">
                        {TIPO_ITEM_LABELS[item.tipo]}
                        {item.uso && ` · ${USO_ITEM_LABELS[item.uso]}`}
                        {item.armazon_propio && ' · Propio'}
                      </td>
                      <td className="py-1.5 text-center">{item.cantidad}</td>
                      <td className="py-1.5 text-right font-medium">{formatARS(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tareas */}
          {tareas.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Tareas</p>
              <div className="space-y-1.5">
                {tareas.map(t => (
                  <div key={t.id} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className={`mt-0.5 inline-flex shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full ${TAREA_BADGE[t.estado]}`}>
                      {t.estado === 'en_proceso' ? 'En proceso' : t.estado === 'en_laboratorio' ? 'En lab.' : 'Terminada'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{t.titulo}</p>
                      {t.laboratorio_nombre && (
                        <p className="text-gray-500">{t.laboratorio_nombre} ({t.laboratorio_tipo})</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totales */}
          <div className="border-t pt-3 space-y-1.5">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatARS(orden.subtotal)}</span>
            </div>
            {orden.costo_trabajo > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Costo de trabajo</span>
                <span>{formatARS(orden.costo_trabajo)}</span>
              </div>
            )}
            {(orden.descuento_pct > 0 || orden.descuento_monto > 0) && (
              <div className="flex justify-between text-gray-500">
                <span>Descuento{orden.descuento_pct > 0 ? ` (${orden.descuento_pct}%)` : ''}</span>
                <span>-{formatARS(orden.descuento_monto)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base pt-1 border-t">
              <span>Total</span>
              <span>{formatARS(orden.total)}</span>
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
          <Button variant="outline" className="gap-2" onClick={() => window.open(`/dashboard/optica/ordenes/${orden.id}/print`, '_blank')}>
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </Button>
          {canEdit && (
            <Link href={`/dashboard/optica/ordenes/${orden.id}`}>
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

// ── Página principal ─────────────────────────────────────────────────────────

export default function OpticaOrdenesClient({ isAdmin }: { isAdmin: boolean }) {
  const { isHome } = useSelectedSucursal()
  const canWrite = isHome !== false
  const [ordenes, setOrdenes] = useState<OrdenRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // Modal vista completa
  const [viewOrden, setViewOrden] = useState<OpticaOrden | null>(null)
  const [loadingView, setLoadingView] = useState(false)

  // Eliminar OT
  const [deletingOrden, setDeletingOrden] = useState<OrdenRow | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Modal pago rápido
  const [pagarOrden, setPagarOrden] = useState<OrdenRow | null>(null)
  const [pagoMetodo, setPagoMetodo] = useState<MetodoPagoOptica>('EFECTIVO')
  const [pagoMonto, setPagoMonto] = useState('')
  const [savingPago, setSavingPago] = useState(false)

  const fetchOrdenes = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (estado !== 'todos') params.set('estado', estado)
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)

    const res = await fetch(`/api/dashboard/optica/ordenes?${params}`)
    const data = await res.json()
    setOrdenes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [q, estado, desde, hasta])

  useEffect(() => {
    const t = setTimeout(fetchOrdenes, 300)
    return () => clearTimeout(t)
  }, [fetchOrdenes])

  async function handleVerOrden(id: number) {
    setLoadingView(true)
    try {
      const res = await fetch(`/api/dashboard/optica/ordenes/${id}`)
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error ?? `Error ${res.status} al cargar la orden`)
        return
      }
      setViewOrden(json)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setLoadingView(false)
    }
  }

  async function handlePagoRapido() {
    if (!pagarOrden) return
    const monto = parseFloat(pagoMonto)
    if (isNaN(monto) || monto <= 0) { toast.error('Ingresá un monto válido'); return }
    setSavingPago(true)
    const res = await fetch(`/api/dashboard/optica/ordenes/${pagarOrden.id}/pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metodo: pagoMetodo, monto, concepto: 'PAGO' }),
    })
    setSavingPago(false)
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error al registrar pago'); return }
    toast.success('Pago registrado')
    setPagarOrden(null)
    fetchOrdenes()
  }

  async function handleEliminar() {
    if (!deletingOrden) return
    setConfirmingDelete(true)
    const res = await fetch(`/api/dashboard/optica/ordenes/${deletingOrden.id}`, { method: 'DELETE' })
    setConfirmingDelete(false)
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error al eliminar'); setDeletingOrden(null); return }
    toast.success(`Orden ${deletingOrden.numero} eliminada`)
    setDeletingOrden(null)
    fetchOrdenes()
  }

  function abrirPago(orden: OrdenRow) {
    const pagado = (orden.optica_orden_pagos ?? []).reduce((a, p) => a + p.monto, 0)
    const saldo = orden.total - pagado
    setPagoMonto(saldo > 0.005 ? saldo.toFixed(2) : '')
    setPagoMetodo('EFECTIVO')
    setPagarOrden(orden)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Órdenes de trabajo óptica</h1>
          <p className="text-sm text-gray-500">{ordenes.length} resultado{ordenes.length !== 1 ? 's' : ''}</p>
        </div>
        {canWrite && (
          <Link href="/dashboard/optica/ordenes/nueva">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nueva OT
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
          <SelectTrigger className="w-52 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map(e => (
              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-38 h-9"
          value={desde}
          onChange={e => setDesde(e.target.value)}
          placeholder="Desde"
        />
        <Input
          type="date"
          className="w-38 h-9"
          value={hasta}
          onChange={e => setHasta(e.target.value)}
          placeholder="Hasta"
        />

        <Button variant="outline" size="sm" onClick={fetchOrdenes} className="h-9">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : ordenes.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium">Sin órdenes</p>
            <p className="text-sm mt-1">Creá la primera con el botón &quot;Nueva OT&quot;</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                <th className="pb-2 pr-4 font-medium">N°</th>
                <th className="pb-2 pr-4 font-medium">Fecha</th>
                <th className="pb-2 pr-4 font-medium">Cliente</th>
                <th className="pb-2 pr-4 font-medium">Prometido</th>
                <th className="pb-2 pr-4 font-medium">Estado</th>
                <th className="pb-2 pr-4 font-medium text-center">Tareas</th>
                <th className="pb-2 pr-4 font-medium text-right">Total</th>
                <th className="pb-2 pr-4 font-medium text-right">Saldo</th>
                <th className="pb-2 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordenes.map(orden => {
                const pagado = (orden.optica_orden_pagos ?? []).reduce((a, p) => a + p.monto, 0)
                const saldo = orden.total - pagado
                const tareas = orden.optica_orden_tareas ?? []
                const tareasTerminadas = tareas.filter(t => t.estado === 'terminada').length

                return (
                  <tr key={orden.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="font-mono font-medium text-gray-900">{orden.numero}</span>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{formatFecha(orden.fecha)}</td>
                    <td className="py-3 pr-4 font-medium">
                      {orden.clientes?.nombre ?? <span className="text-gray-400 italic">Sin cliente</span>}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {orden.fecha_prometida ? formatFecha(orden.fecha_prometida) : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[orden.estado]}`}>
                        {ESTADO_OPTICA_LABELS[orden.estado]}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-center text-gray-600">
                      {tareas.length > 0 ? `${tareasTerminadas}/${tareas.length}` : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-medium">{formatARS(orden.total)}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className={saldo > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                        {formatARS(saldo)}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => handleVerOrden(orden.id)}
                          title="Ver detalle"
                          disabled={loadingView}
                          className="p-1.5 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.open(`/dashboard/optica/ordenes/${orden.id}/print`, '_blank')}
                          title="Imprimir / PDF"
                          className="p-1.5 rounded-md text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {canWrite && (
                          <Link
                            href={`/dashboard/optica/ordenes/${orden.id}`}
                            title="Editar"
                            className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                        )}
                        {canWrite && saldo > 0.005 && !['anulado', 'entregado'].includes(orden.estado) && (
                          <button
                            onClick={() => abrirPago(orden)}
                            title="Registrar pago"
                            className="p-1.5 rounded-md text-green-600 hover:bg-green-50 transition-colors"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                        {isAdmin && canWrite
                          && (orden.optica_orden_tareas ?? []).length === 0
                          && (orden.optica_orden_pagos ?? []).length === 0
                          && (
                          <button
                            onClick={() => setDeletingOrden(orden)}
                            title="Eliminar orden"
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
      <OrdenViewDialog orden={viewOrden} onClose={() => setViewOrden(null)} canEdit={canWrite} />

      {/* Confirmar eliminación */}
      <Dialog open={!!deletingOrden} onOpenChange={open => { if (!open) setDeletingOrden(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar orden — {deletingOrden?.numero}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-1">
            Esta acción es irreversible. ¿Confirmás que querés eliminar la orden <span className="font-mono font-medium">{deletingOrden?.numero}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingOrden(null)} disabled={confirmingDelete}>Cancelar</Button>
            <Button variant="destructive" onClick={handleEliminar} disabled={confirmingDelete}>
              {confirmingDelete ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal pago rápido */}
      <Dialog open={!!pagarOrden} onOpenChange={open => { if (!open) setPagarOrden(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Registrar pago — {pagarOrden?.numero}
            </DialogTitle>
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
            <Button variant="outline" onClick={() => setPagarOrden(null)}>Cancelar</Button>
            <Button onClick={handlePagoRapido} disabled={savingPago || !pagoMonto}>
              {savingPago ? 'Registrando…' : 'Confirmar pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
