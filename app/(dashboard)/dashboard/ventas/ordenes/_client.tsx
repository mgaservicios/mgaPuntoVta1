'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Eye, Pencil, CreditCard, Trash2, Printer } from 'lucide-react'
import { useSelectedSucursal } from '@/hooks/useSelectedSucursal'
import { usePermissions } from '@/components/PermissionsProvider'
import { toast } from 'sonner'
import { buttonVariants, Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { CONDICION_LABELS } from '@/types/ordenes'
import type { OrdenVenta, CondicionPago } from '@/types/ordenes'

const METODOS_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA_DEBITO', label: 'Tarjeta débito' },
  { value: 'TARJETA_CREDITO', label: 'Tarjeta crédito' },
  { value: 'CUENTA_CORRIENTE', label: 'Cuenta corriente' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTRO', label: 'Otro' },
]

type OrdenRow = Pick<OrdenVenta, 'id' | 'numero' | 'fecha' | 'vencimiento' | 'estado' | 'condicion_pago' | 'total'> & {
  clientes?: { nombre: string } | null
  users?: { name: string | null; email: string } | null
  orden_venta_pagos?: { monto: number }[]
}

const ESTADO_VARIANT = {
  borrador: 'outline',
  confirmada: 'default',
  anulada: 'destructive',
} as const

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function OrdenesClient({ isAdmin }: { isAdmin: boolean }) {
  const { isHome } = useSelectedSucursal()
  const canWrite = isHome !== false
  const { can } = usePermissions()
  const [ordenes, setOrdenes] = useState<OrdenRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [estado, setEstado] = useState('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  // Modal pago rápido
  const [pagarOrden, setPagarOrden] = useState<OrdenRow | null>(null)
  const [pagoMetodo, setPagoMetodo] = useState('EFECTIVO')
  const [pagoMonto, setPagoMonto] = useState('')
  const [savingPago, setSavingPago] = useState(false)

  // Eliminar orden
  const [deletingOrden, setDeletingOrden] = useState<OrdenRow | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const fetchOrdenes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (estado !== 'todos') params.set('estado', estado)
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      const res = await fetch(`/api/dashboard/ordenes?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? `Error ${res.status}`)
        setOrdenes([])
      } else {
        setOrdenes(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
      setOrdenes([])
    } finally {
      setLoading(false)
    }
  }, [estado, desde, hasta])

  useEffect(() => { fetchOrdenes() }, [fetchOrdenes])

  async function handlePagoRapido() {
    if (!pagarOrden) return
    const monto = parseFloat(pagoMonto)
    if (isNaN(monto) || monto <= 0) { toast.error('Ingresá un monto válido'); return }
    setSavingPago(true)
    const res = await fetch(`/api/dashboard/ordenes/${pagarOrden.id}/pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metodo: pagoMetodo, monto }),
    })
    setSavingPago(false)
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error'); return }
    toast.success('Pago registrado')
    setPagarOrden(null)
    fetchOrdenes()
  }

  async function handleEliminar() {
    if (!deletingOrden) return
    setConfirmingDelete(true)
    const res = await fetch(`/api/dashboard/ordenes/${deletingOrden.id}`, { method: 'DELETE' })
    setConfirmingDelete(false)
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error al eliminar'); setDeletingOrden(null); return }
    toast.success(`Orden ${deletingOrden.numero} eliminada`)
    setDeletingOrden(null)
    fetchOrdenes()
  }

  function abrirPago(orden: OrdenRow) {
    const pagado = (orden.orden_venta_pagos ?? []).reduce((a, p) => a + p.monto, 0)
    const saldo = orden.total - pagado
    setPagoMonto(saldo > 0.005 ? saldo.toFixed(2) : '')
    setPagoMetodo('EFECTIVO')
    setPagarOrden(orden)
  }

  const totalConfirmadas = ordenes
    .filter(o => o.estado === 'confirmada')
    .reduce((acc, o) => acc + o.total, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Órdenes de venta</h2>
        {canWrite && can('ventas.ordenes.crear') && (
          <Link href="/dashboard/ventas/ordenes/nueva" className={buttonVariants()}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva orden
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="w-48">
          <Select value={estado} onValueChange={(v) => { if (v) setEstado(v) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="confirmada">Confirmada</SelectItem>
              <SelectItem value="anulada">Anulada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input type="date" className="w-40" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <Input type="date" className="w-40" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      </div>

      {/* Resumen */}
      {ordenes.some(o => o.estado === 'confirmada') && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            {ordenes.filter(o => o.estado === 'confirmada').length} órdenes confirmadas
          </span>
          <span className="text-sm font-semibold text-blue-800">{formatARS(totalConfirmadas)}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Error al cargar órdenes: {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">N°</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right w-32">Total</TableHead>
              <TableHead className="text-right w-28">Saldo</TableHead>
              <TableHead className="w-28">Estado</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : ordenes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">Sin órdenes</TableCell>
              </TableRow>
            ) : ordenes.map(o => (
              <TableRow key={o.id} className={o.estado === 'anulada' ? 'opacity-50' : ''}>
                <TableCell className="font-mono font-medium text-sm">{o.numero}</TableCell>
                <TableCell className="text-gray-600 text-sm">{formatFecha(o.fecha)}</TableCell>
                <TableCell className="text-sm text-gray-700">
                  <div className="truncate max-w-[180px]">
                    {o.clientes?.nombre ?? <span className="text-gray-400">Consumidor final</span>}
                  </div>
                  <div className="text-xs text-gray-400">{CONDICION_LABELS[o.condicion_pago as CondicionPago]}</div>
                </TableCell>
                <TableCell className="text-right font-medium">{formatARS(o.total)}</TableCell>
                <TableCell className="text-right">
                  {(() => {
                    const pagado = (o.orden_venta_pagos ?? []).reduce((a, p) => a + p.monto, 0)
                    const saldo = o.total - pagado
                    return saldo > 0.005 && o.estado !== 'anulada' ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-red-600 font-medium text-sm">{formatARS(saldo)}</span>
                        {canWrite && can('ventas.ordenes.confirmar') && (
                          <button
                            onClick={() => abrirPago(o)}
                            title="Registrar pago"
                            className="p-1 rounded text-green-600 hover:bg-green-50"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : <span className="text-green-600 text-sm">{formatARS(0)}</span>
                  })()}
                </TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[o.estado]}>
                    {o.estado.charAt(0).toUpperCase() + o.estado.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    <Link
                      href={`/dashboard/ventas/ordenes/${o.id}/print`}
                      target="_blank"
                      title="Imprimir orden"
                      className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                    >
                      <Printer className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/dashboard/ventas/ordenes/${o.id}`}
                      title="Ver detalle"
                      className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    {canWrite && can('ventas.ordenes.editar') && (
                      <Link
                        href={`/dashboard/ventas/ordenes/${o.id}`}
                        title="Editar"
                        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                    )}
                    {isAdmin && canWrite && o.estado === 'borrador' && (
                      <button
                        onClick={() => setDeletingOrden(o)}
                        title="Eliminar orden"
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
            <DialogTitle>Registrar pago — {pagarOrden?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="mb-1.5 block text-sm">Método de pago</Label>
              <select
                className="w-full h-9 text-sm border border-input rounded-md px-2 bg-white"
                value={pagoMetodo}
                onChange={e => setPagoMetodo(e.target.value)}
              >
                {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
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
