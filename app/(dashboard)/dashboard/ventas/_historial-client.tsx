'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Eye, Printer, Plus, CreditCard, Trash2, Pencil } from 'lucide-react'
import { usePermissions } from '@/components/PermissionsProvider'
import { buttonVariants, Button } from '@/components/ui/button'
import { useSelectedSucursal } from '@/hooks/useSelectedSucursal'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { CONDICION_LABELS } from '@/types/ordenes'
import type { Venta } from '@/types/ventas'
import type { OrdenVenta, CondicionPago } from '@/types/ordenes'
import FormasPagoCobro from '@/components/pago/FormasPagoCobro'
import type { PagoFormData } from '@/components/pago/FormasPagoCobro'

// ── Types ─────────────────────────────────────────────────────────────────────

type VentaRow = Pick<Venta, 'id' | 'numero' | 'fecha' | 'estado' | 'subtotal' | 'descuento_monto' | 'total'> & {
  clientes?: { nombre: string } | null
  vendedores?: { nombre: string } | null
  nombre_sucursal?: string | null
}

type OrdenRow = Pick<OrdenVenta, 'id' | 'numero' | 'fecha' | 'vencimiento' | 'estado' | 'condicion_pago' | 'total'> & {
  clientes?: { nombre: string } | null
  users?: { name: string | null; email: string } | null
  orden_venta_pagos?: { monto: number }[]
}

const ORDEN_ESTADO_VARIANT = {
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

// ── Filtros compartidos ───────────────────────────────────────────────────────

function FiltrosFecha({ desde, setDesde, hasta, setHasta }: {
  desde: string; setDesde: (v: string) => void
  hasta: string; setHasta: (v: string) => void
}) {
  return (
    <>
      <Input type="date" className="w-40" value={desde} onChange={(e) => setDesde(e.target.value)} />
      <Input type="date" className="w-40" value={hasta} onChange={(e) => setHasta(e.target.value)} />
    </>
  )
}

// ── Tab Ventas POS ────────────────────────────────────────────────────────────

function VentasPOSTab({ canWrite }: { canWrite: boolean }) {
  const { can } = usePermissions()
  const [ventas, setVentas] = useState<VentaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [estado, setEstado] = useState('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const fetchVentas = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (estado !== 'todos') params.set('estado', estado)
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    const res = await fetch(`/api/dashboard/ventas?${params}`)
    const data = await res.json()
    setVentas(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [estado, desde, hasta])

  useEffect(() => { fetchVentas() }, [fetchVentas])

  const totalPeriodo = ventas.filter(v => v.estado === 'completada').reduce((acc, v) => acc + v.total, 0)
  const showSucursal = ventas.some(v => v.nombre_sucursal)

  return (
    <div className="space-y-4 mt-3">
      <div className="flex flex-wrap gap-3">
        <div className="w-44">
          <Select value={estado} onValueChange={(v) => { if (v) setEstado(v) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="completada">Completada</SelectItem>
              <SelectItem value="anulada">Anulada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <FiltrosFecha desde={desde} setDesde={setDesde} hasta={hasta} setHasta={setHasta} />
        {canWrite && can('ventas.pos.cobrar') && (
          <div className="ml-auto">
            <Link href="/dashboard/ventas/pos" className={buttonVariants()}>
              + Ticket venta
            </Link>
          </div>
        )}
      </div>

      {ventas.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-blue-700">{ventas.filter(v => v.estado === 'completada').length} ventas completadas</span>
          <span className="text-sm font-semibold text-blue-800">{formatARS(totalPeriodo)}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">N°</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              {showSucursal && <TableHead className="w-40">Sucursal</TableHead>}
              <TableHead>Cliente</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right w-32">Total</TableHead>
              <TableHead className="w-28">Estado</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={showSucursal ? 8 : 7} className="text-center py-8 text-gray-400">Cargando…</TableCell></TableRow>
            ) : ventas.length === 0 ? (
              <TableRow><TableCell colSpan={showSucursal ? 8 : 7} className="text-center py-8 text-gray-400">Sin ventas en el período</TableCell></TableRow>
            ) : ventas.map(v => (
              <TableRow key={v.id} className={v.estado === 'anulada' ? 'opacity-50' : ''}>
                <TableCell className="font-mono font-medium text-sm">{v.numero}</TableCell>
                <TableCell className="text-gray-600 text-sm">{formatFecha(v.fecha)}</TableCell>
                {showSucursal && <TableCell className="text-xs text-gray-500">{v.nombre_sucursal ?? '—'}</TableCell>}
                <TableCell className="text-sm text-gray-700">{v.clientes?.nombre ?? <span className="text-gray-400">Consumidor final</span>}</TableCell>
                <TableCell className="text-sm text-gray-600">{v.vendedores?.nombre || '—'}</TableCell>
                <TableCell className="text-right font-medium">{formatARS(v.total)}</TableCell>
                <TableCell>
                  <Badge variant={v.estado === 'completada' ? 'default' : 'destructive'}>
                    {v.estado === 'completada' ? 'Completada' : 'Anulada'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    {v.estado === 'completada' && (
                      <Link href={`/dashboard/ventas/${v.id}/print`} target="_blank" className={buttonVariants({ variant: 'ghost', size: 'icon' })} title="Imprimir ticket">
                        <Printer className="w-4 h-4" />
                      </Link>
                    )}
                    <Link href={`/dashboard/ventas/${v.id}`} className={buttonVariants({ variant: 'ghost', size: 'icon' })} title="Ver detalle">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ── Tab Órdenes de venta ──────────────────────────────────────────────────────

function OrdenesTab({ isAdmin, canWrite }: { isAdmin: boolean; canWrite: boolean }) {
  const { can } = usePermissions()
  const [ordenes, setOrdenes] = useState<OrdenRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [estado, setEstado] = useState('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const [pagarOrden, setPagarOrden] = useState<OrdenRow | null>(null)
  const [pagoData, setPagoData] = useState<PagoFormData | null>(null)
  const [savingPago, setSavingPago] = useState(false)

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
      if (!res.ok) { setError(data?.error ?? `Error ${res.status}`); setOrdenes([]) }
      else setOrdenes(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
      setOrdenes([])
    } finally {
      setLoading(false)
    }
  }, [estado, desde, hasta])

  useEffect(() => { fetchOrdenes() }, [fetchOrdenes])

  async function handlePagoRapido() {
    if (!pagarOrden || !pagoData) return
    const monto = parseFloat(pagoData.monto)
    if (isNaN(monto) || monto <= 0) { toast.error('Ingresá un monto válido'); return }
    setSavingPago(true)
    const res = await fetch(`/api/dashboard/ordenes/${pagarOrden.id}/pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metodo: pagoData.metodo,
        monto,
        forma_pago_id: pagoData.forma_pago_id,
        cuotas: pagoData.cuotas,
        referencia: pagoData.referencia || null,
        fecha_pago: pagoData.fecha_pago || null,
        nota_credito_id: pagoData.nota_credito_id,
      }),
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
    setPagoData(null)
    setPagarOrden(orden)
  }

  const totalConfirmadas = ordenes.filter(o => o.estado === 'confirmada').reduce((acc, o) => acc + o.total, 0)

  return (
    <div className="space-y-4 mt-3">
      <div className="flex flex-wrap gap-3">
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
        <FiltrosFecha desde={desde} setDesde={setDesde} hasta={hasta} setHasta={setHasta} />
        {canWrite && can('ventas.ordenes.crear') && (
          <div className="ml-auto">
            <Link href="/dashboard/ventas/ordenes/nueva" className={buttonVariants()}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva orden
            </Link>
          </div>
        )}
      </div>

      {ordenes.some(o => o.estado === 'confirmada') && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-blue-700">{ordenes.filter(o => o.estado === 'confirmada').length} órdenes confirmadas</span>
          <span className="text-sm font-semibold text-blue-800">{formatARS(totalConfirmadas)}</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
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
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">Cargando…</TableCell></TableRow>
            ) : ordenes.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-400">Sin órdenes</TableCell></TableRow>
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
                          <button onClick={() => abrirPago(o)} title="Registrar pago" className="p-1 rounded text-green-600 hover:bg-green-50">
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : <span className="text-green-600 text-sm">{formatARS(0)}</span>
                  })()}
                </TableCell>
                <TableCell>
                  <Badge variant={ORDEN_ESTADO_VARIANT[o.estado]}>
                    {o.estado.charAt(0).toUpperCase() + o.estado.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    <Link href={`/dashboard/ventas/ordenes/${o.id}/print`} target="_blank" title="Imprimir" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                      <Printer className="w-4 h-4" />
                    </Link>
                    <Link href={`/dashboard/ventas/ordenes/${o.id}`} title="Ver detalle" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                      <Eye className="w-4 h-4" />
                    </Link>
                    {canWrite && can('ventas.ordenes.editar') && (
                      <Link href={`/dashboard/ventas/ordenes/${o.id}`} title="Editar" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                        <Pencil className="w-4 h-4" />
                      </Link>
                    )}
                    {isAdmin && canWrite && o.estado === 'borrador' && (
                      <button onClick={() => setDeletingOrden(o)} title="Eliminar" className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
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
          <DialogHeader><DialogTitle>Eliminar orden — {deletingOrden?.numero}</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600 py-1">
            Esta acción es irreversible. ¿Confirmás que querés eliminar <span className="font-mono font-medium">{deletingOrden?.numero}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingOrden(null)} disabled={confirmingDelete}>Cancelar</Button>
            <Button variant="destructive" onClick={handleEliminar} disabled={confirmingDelete}>
              {confirmingDelete ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pago rápido */}
      <Dialog open={!!pagarOrden} onOpenChange={open => { if (!open) setPagarOrden(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Registrar pago — {pagarOrden?.numero}</DialogTitle></DialogHeader>
          <div className="py-1">
            {pagarOrden && (() => {
              const pagado = (pagarOrden.orden_venta_pagos ?? []).reduce((a, p) => a + p.monto, 0)
              const saldo = Math.max(0, pagarOrden.total - pagado)
              return (
                <FormasPagoCobro
                  saldo={saldo}
                  defaultValue={{ monto: saldo > 0.005 ? saldo.toFixed(2) : '' }}
                  onChange={setPagoData}
                />
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagarOrden(null)}>Cancelar</Button>
            <Button onClick={handlePagoRapido} disabled={savingPago || !pagoData}>
              {savingPago ? 'Registrando…' : 'Confirmar pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Page principal ────────────────────────────────────────────────────────────

export default function HistorialClient({ isAdmin }: { isAdmin: boolean }) {
  const { isHome } = useSelectedSucursal()
  const canWrite = isHome !== false

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Historial</h2>
      <Tabs defaultValue="pos">
        <TabsList>
          <TabsTrigger value="pos">Ventas POS</TabsTrigger>
          <TabsTrigger value="ordenes">Órdenes de venta</TabsTrigger>
        </TabsList>
        <TabsContent value="pos">
          <VentasPOSTab canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="ordenes">
          <OrdenesTab isAdmin={isAdmin} canWrite={canWrite} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
