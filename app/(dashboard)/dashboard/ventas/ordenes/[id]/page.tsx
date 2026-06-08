'use client'

import { useEffect, useState, use, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Trash2, X, Save, CheckCircle, XCircle, Search, ChevronDown, Printer,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import {
  CONDICION_LABELS, METODO_ORDEN_LABELS,
  type OrdenVenta, type CondicionPago, type MetodoPagoOrden,
} from '@/types/ordenes'
import type { Cliente } from '@/types/clientes'
import type { NotaCredito } from '@/types/notas-credito'
import ClienteSearch from '@/components/dashboard/ClienteSearch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useSucursalActiva } from '@/hooks/useSucursalActiva'

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface ArticuloResult {
  id: number
  codigo: string | null
  nombre: string
  tipo_articulo: 'simple' | 'con_variantes'
  precio_venta: number | null
  stock_actual: number
}

interface VarianteResult {
  id: number
  sku: string | null
  precio_venta: number | null
  stock_actual: number
  activo: boolean
  variante_atributos?: { valor: string; atributo_tipos?: { nombre: string } | null }[]
}

interface FormItem {
  key: string
  articulo_id: number
  variante_id: number | null
  nombre_articulo: string
  descripcion_variante: string | null
  cantidad: number
  precio_unitario: number
  descuento_pct: number
}

interface FormPago {
  metodo: MetodoPagoOrden
  monto: string
  referencia: string
  fecha_pago: string
  nota_credito_id?: number
}

// ── Constantes ────────────────────────────────────────────────────────────────

const CONDICIONES: CondicionPago[] = ['contado', '30_dias', '60_dias', '90_dias', 'cuenta_corriente', 'otro']
const METODOS: MetodoPagoOrden[] = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CUENTA_CORRIENTE', 'NOTA_CREDITO', 'CHEQUE', 'OTRO']

const ESTADO_VARIANT = { borrador: 'outline', confirmada: 'default', anulada: 'destructive' } as const

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function varLabel(v: VarianteResult) {
  const attrs = v.variante_atributos ?? []
  if (!attrs.length) return v.sku ?? `Variante #${v.id}`
  return attrs.map(a => `${a.atributo_tipos?.nombre ?? ''}: ${a.valor}`).join(' / ')
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function OrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'nueva'
  const router = useRouter()
  const sucursalNombre = useSucursalActiva()

  const [orden, setOrden] = useState<OrdenVenta | null>(null)
  const [loading, setLoading] = useState(!isNew)

  // Listas de precio
  const [listas, setListas] = useState<{ id: number; nombre: string }[]>([])
  const [listaId, setListaId] = useState<number | null>(null)

  // Form state
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [vencimiento, setVencimiento] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [condicionPago, setCondicionPago] = useState<CondicionPago>('contado')
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState<FormItem[]>([])
  const [descuentoGlobal, setDescuentoGlobal] = useState('0')
  const [pagos, setPagos] = useState<FormPago[]>([])
  const [ncsDisponibles, setNcsDisponibles] = useState<NotaCredito[]>([])

  // Búsqueda de artículos
  const [q, setQ] = useState('')
  const [searchResults, setSearchResults] = useState<ArticuloResult[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [expandingId, setExpandingId] = useState<number | null>(null)
  const [variantesCache, setVariantesCache] = useState<Record<number, VarianteResult[]>>({})
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Acciones
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [anulando, setAnulando] = useState(false)
  const [showAnular, setShowAnular] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)

  // Pago en vista confirmada
  const [showPagoModal, setShowPagoModal] = useState(false)
  const [pagoMetodo, setPagoMetodo] = useState('EFECTIVO')
  const [pagoMonto, setPagoMonto] = useState('')
  const [savingPago, setSavingPago] = useState(false)

  // ── Carga de orden existente ──

  function populateForm(o: OrdenVenta) {
    setFecha(o.fecha)
    setVencimiento(o.vencimiento ?? '')
    setCondicionPago(o.condicion_pago)
    setObservaciones(o.observaciones ?? '')
    setDescuentoGlobal(String(o.descuento_pct))
    if (o.clientes) {
      setCliente({ id: o.cliente_id!, nombre: o.clientes.nombre, telefono: o.clientes.telefono ?? null } as Cliente)
    }
    setItems((o.orden_venta_items ?? []).map(i => ({
      key: i.variante_id ? `a${i.articulo_id}-v${i.variante_id}` : `a${i.articulo_id}`,
      articulo_id: i.articulo_id,
      variante_id: i.variante_id,
      nombre_articulo: i.nombre_articulo,
      descripcion_variante: i.descripcion_variante,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      descuento_pct: i.descuento_pct,
    })))
    setPagos((o.orden_venta_pagos ?? []).map(p => ({
      metodo: p.metodo,
      monto: String(p.monto),
      referencia: p.referencia ?? '',
      fecha_pago: p.fecha_pago ?? '',
      nota_credito_id: p.nota_credito_id ?? undefined,
    })))
  }

  useEffect(() => {
    fetch('/api/dashboard/listas-precio')
      .then(r => r.json())
      .then(data => {
        const venta = (Array.isArray(data) ? data : []).filter((l: { categoria: string; activo: boolean }) => l.categoria === 'venta' && l.activo)
        setListas(venta)
        const def = venta.find((l: { nombre: string }) => /p[uú]blic/i.test(l.nombre)) ?? venta[0]
        if (def) setListaId(def.id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (isNew) return
    setLoading(true)
    fetch(`/api/dashboard/ordenes/${id}`)
      .then(async r => {
        const data = await r.json()
        if (!r.ok) { setLoading(false); return }
        setOrden(data)
        if (data.estado === 'borrador') populateForm(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id, isNew]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar NCs cuando cambia el cliente
  useEffect(() => {
    if (!cliente) { setNcsDisponibles([]); return }
    fetch(`/api/dashboard/notas-credito?cliente_id=${cliente.id}&estado=pendiente`)
      .then(r => r.json())
      .then(data => setNcsDisponibles(Array.isArray(data) ? data : []))
      .catch(() => setNcsDisponibles([]))
  }, [cliente])

  // ── Búsqueda de artículos ──

  const buscar = useCallback((texto: string) => {
    clearTimeout(debounce.current)
    if (!texto.trim()) { setSearchResults([]); return }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/dashboard/articulos?q=${encodeURIComponent(texto)}`)
      const data = await res.json()
      setSearchResults(Array.isArray(data) ? data.slice(0, 10) : [])
    }, 250)
  }, [])

  useEffect(() => { buscar(q) }, [q, buscar])

  async function loadVariantes(articuloId: number) {
    if (variantesCache[articuloId]) return
    const res = await fetch(`/api/dashboard/articulos/${articuloId}`)
    const data = await res.json()
    setVariantesCache(prev => ({
      ...prev,
      [articuloId]: (data.articulo_variantes ?? []).filter((v: VarianteResult) => v.activo),
    }))
  }

  async function handleSelectArticulo(a: ArticuloResult) {
    if (a.tipo_articulo === 'con_variantes') {
      if (expandingId === a.id) { setExpandingId(null); return }
      setExpandingId(a.id)
      await loadVariantes(a.id)
    } else {
      addItem(a)
    }
  }

  async function addItem(a: ArticuloResult, v?: VarianteResult) {
    const key = v ? `a${a.id}-v${v.id}` : `a${a.id}`
    let precio = v?.precio_venta ?? a.precio_venta ?? 0
    if (listaId) {
      try {
        const url = `/api/dashboard/articulos/${a.id}/precios${v ? `?variante_id=${v.id}` : ''}`
        const res = await fetch(url)
        const data = await res.json()
        const pv = (data.vigentes ?? []).find((p: { lista_precio_id: number; precio_calculado?: number; precio: number }) => p.lista_precio_id === listaId)
        if (pv) precio = pv.precio_calculado ?? pv.precio
      } catch {}
    }
    const desc = v ? varLabel(v) : null
    setItems(prev => {
      const exists = prev.find(i => i.key === key)
      if (exists) return prev.map(i => i.key === key ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, {
        key, articulo_id: a.id, variante_id: v?.id ?? null,
        nombre_articulo: a.nombre, descripcion_variante: desc,
        precio_unitario: precio, cantidad: 1, descuento_pct: 0,
      }]
    })
    setQ(''); setSearchResults([]); setShowSearch(false); setExpandingId(null)
  }

  function updateItem(key: string, field: keyof FormItem, raw: string) {
    const val = parseFloat(raw)
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: isNaN(val) ? 0 : val } : i))
  }

  // ── Totales ──

  const subtotal = items.reduce((acc, i) =>
    acc + Math.round(i.cantidad * i.precio_unitario * (1 - i.descuento_pct / 100) * 100) / 100, 0)
  const descPct = parseFloat(descuentoGlobal) || 0
  const descMonto = Math.round(subtotal * (descPct / 100) * 100) / 100
  const total = subtotal - descMonto
  const totalPagado = pagos.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0)
  const diferenciaPago = Math.max(0, total - totalPagado)

  // ── Construcción de payload ──

  function buildPayload() {
    return {
      fecha,
      vencimiento: vencimiento || null,
      cliente_id: cliente?.id ?? null,
      condicion_pago: condicionPago,
      descuento_pct: descPct,
      observaciones: observaciones || null,
      items: items.map(i => ({
        articulo_id: i.articulo_id,
        variante_id: i.variante_id,
        nombre_articulo: i.nombre_articulo,
        descripcion_variante: i.descripcion_variante,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        descuento_pct: i.descuento_pct,
      })),
      pagos: pagos
        .filter(p => parseFloat(p.monto) > 0)
        .map(p => ({
          metodo: p.metodo,
          monto: parseFloat(p.monto),
          referencia: p.referencia || null,
          fecha_pago: p.fecha_pago || null,
          ...(p.nota_credito_id ? { nota_credito_id: p.nota_credito_id } : {}),
        })),
    }
  }

  async function handleSave() {
    if (items.length === 0) { toast.error('Agregá al menos un ítem'); return }
    setSaving(true)
    const payload = buildPayload()
    const res = await fetch(
      isNew ? '/api/dashboard/ordenes' : `/api/dashboard/ordenes/${id}`,
      { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    )
    setSaving(false)
    if (res.ok) {
      toast.success(isNew ? 'Orden guardada como borrador' : 'Orden actualizada')
      if (isNew) { const d = await res.json(); router.replace(`/dashboard/ventas/ordenes/${d.id}`) }
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al guardar')
    }
  }

  async function handleConfirmar() {
    if (items.length === 0) { toast.error('Agregá al menos un ítem'); return }
    setConfirming(true)

    // Guardar primero si hay cambios pendientes
    const payload = buildPayload()
    const saveRes = await fetch(
      isNew ? '/api/dashboard/ordenes' : `/api/dashboard/ordenes/${id}`,
      { method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    )
    if (!saveRes.ok) {
      const err = await saveRes.json()
      toast.error(err.error ?? 'Error al guardar')
      setConfirming(false)
      setShowConfirmar(false)
      return
    }

    const ordenId = isNew ? (await saveRes.json()).id : Number(id)
    const confRes = await fetch(`/api/dashboard/ordenes/${ordenId}/confirmar`, { method: 'POST' })
    setConfirming(false)
    setShowConfirmar(false)
    if (confRes.ok) {
      toast.success('Orden confirmada')
      router.replace(`/dashboard/ventas/ordenes/${ordenId}`)
    } else {
      const err = await confRes.json()
      toast.error(err.error ?? 'Error al confirmar')
      if (isNew) router.replace(`/dashboard/ventas/ordenes/${ordenId}`)
    }
  }

  async function handleAnular() {
    setAnulando(true)
    const res = await fetch(`/api/dashboard/ordenes/${id}/anular`, { method: 'POST' })
    setAnulando(false)
    setShowAnular(false)
    if (res.ok) {
      toast.success('Orden anulada')
      setOrden(prev => prev ? { ...prev, estado: 'anulada' } : prev)
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al anular')
    }
  }

  async function handleRegistrarPago() {
    const monto = parseFloat(pagoMonto)
    if (isNaN(monto) || monto <= 0) { toast.error('Ingresá un monto válido'); return }
    setSavingPago(true)
    const res = await fetch(`/api/dashboard/ordenes/${id}/pago`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metodo: pagoMetodo, monto }),
    })
    setSavingPago(false)
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error'); return }
    toast.success('Pago registrado')
    setShowPagoModal(false)
    // Recargar orden para actualizar pagos
    const r = await fetch(`/api/dashboard/ordenes/${id}`)
    if (r.ok) { const d = await r.json(); setOrden(d) }
  }

  // ── Estados de carga ──

  if (loading) return <div className="text-gray-400 text-sm">Cargando…</div>

  const isEditable = isNew || orden?.estado === 'borrador'

  // ═══════════════════════════════════════════════════════════════════════════
  // MODO VISTA (confirmada / anulada)
  // ═══════════════════════════════════════════════════════════════════════════

  if (!isEditable && orden) {
    const items = orden.orden_venta_items ?? []
    const pagos = orden.orden_venta_pagos ?? []

    return (
      <div className="max-w-3xl">
        <button onClick={() => { router.refresh(); router.push('/dashboard/ventas/ordenes') }}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-gray-800 font-mono">{orden.numero}</h2>
              <Badge variant={ESTADO_VARIANT[orden.estado] ?? 'outline'}>
                {orden.estado ? orden.estado.charAt(0).toUpperCase() + orden.estado.slice(1) : ''}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">{formatFecha(orden.fecha)}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/dashboard/ventas/ordenes/${id}/print`}
              target="_blank"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </Link>
            {orden.estado === 'confirmada' && (
              <Button variant="outline" className="text-red-500 hover:text-red-600"
                onClick={() => setShowAnular(true)}>
                <XCircle className="w-4 h-4 mr-2" /> Anular
              </Button>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Cliente</p>
            <p className="text-sm font-medium text-gray-800">{orden.clientes?.nombre ?? 'Consumidor final'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Condición de pago</p>
            <p className="text-sm font-medium text-gray-800">{CONDICION_LABELS[orden.condicion_pago]}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Vendedor</p>
            <p className="text-sm font-medium text-gray-800">
              {(orden.users as { name: string | null; email: string } | null)?.name ||
               (orden.users as { name: string | null; email: string } | null)?.email || '—'}
            </p>
          </div>
          {orden.vencimiento && (
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Vencimiento</p>
              <p className="text-sm font-medium text-gray-800">{formatFecha(orden.vencimiento)}</p>
            </div>
          )}
          {orden.observaciones && (
            <div className="col-span-2">
              <p className="text-xs text-gray-400 mb-0.5">Observaciones</p>
              <p className="text-sm text-gray-700">{orden.observaciones}</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Artículo</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-24">Cantidad</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Precio</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{item.nombre_articulo}</p>
                    {item.descripcion_variante && (
                      <p className="text-xs text-gray-400">{item.descripcion_variante}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">{Number(item.cantidad).toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {formatARS(item.precio_unitario)}
                    {item.descuento_pct > 0 && (
                      <span className="text-xs text-red-400 ml-1">-{item.descuento_pct}%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatARS(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagos + Totales */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Forma de pago</p>
              {(() => {
                const totalPagado = pagos.reduce((a, p) => a + p.monto, 0)
                const saldoPendiente = orden.total - totalPagado
                return saldoPendiente > 0.005 && orden.estado !== 'anulada' ? (
                  <button
                    onClick={() => {
                      setPagoMonto(saldoPendiente.toFixed(2))
                      setPagoMetodo('EFECTIVO')
                      setShowPagoModal(true)
                    }}
                    className="flex items-center gap-1 text-xs text-green-700 border border-green-300 bg-green-50 hover:bg-green-100 rounded px-2 py-1"
                  >
                    <span>Registrar pago</span>
                  </button>
                ) : null
              })()}
            </div>
            {pagos.length === 0 ? (
              <p className="text-sm text-gray-400">No especificada</p>
            ) : (
              <div className="space-y-2">
                {pagos.map(p => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{METODO_ORDEN_LABELS[p.metodo]}</span>
                    <div className="text-right">
                      <span className="font-medium">{formatARS(p.monto)}</span>
                      {p.fecha_pago && <p className="text-xs text-gray-400">{formatFecha(p.fecha_pago)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Totales</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>{formatARS(orden.subtotal)}</span>
            </div>
            {orden.descuento_monto > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Descuento ({orden.descuento_pct}%)</span>
                <span className="text-red-500">-{formatARS(orden.descuento_monto)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2">
              <span>Total</span>
              <span>{formatARS(orden.total)}</span>
            </div>
            {(() => {
              const totalPagado = pagos.reduce((a, p) => a + p.monto, 0)
              const saldo = orden.total - totalPagado
              return totalPagado > 0 ? (
                <>
                  <div className="flex justify-between text-sm text-gray-500 border-t border-gray-100 pt-2">
                    <span>Pagado</span>
                    <span>{formatARS(totalPagado)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Saldo</span>
                    <span className={saldo > 0.005 ? 'text-red-600' : 'text-green-600'}>{formatARS(saldo)}</span>
                  </div>
                </>
              ) : null
            })()}
          </div>
        </div>

        {/* Modal pago */}
        <Dialog open={showPagoModal} onOpenChange={setShowPagoModal}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Registrar pago — {orden.numero}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div>
                <Label className="mb-1.5 block text-sm">Método de pago</Label>
                <select
                  className="w-full h-9 text-sm border border-input rounded-md px-2 bg-white"
                  value={pagoMetodo}
                  onChange={e => setPagoMetodo(e.target.value)}
                >
                  {[
                    ['EFECTIVO', 'Efectivo'], ['TRANSFERENCIA', 'Transferencia'],
                    ['TARJETA_DEBITO', 'Tarjeta débito'], ['TARJETA_CREDITO', 'Tarjeta crédito'],
                    ['CUENTA_CORRIENTE', 'Cuenta corriente'], ['CHEQUE', 'Cheque'], ['OTRO', 'Otro'],
                  ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
              <Button variant="outline" onClick={() => setShowPagoModal(false)}>Cancelar</Button>
              <Button onClick={handleRegistrarPago} disabled={savingPago || !pagoMonto}>
                {savingPago ? 'Registrando…' : 'Confirmar pago'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={showAnular}
          title="Anular orden"
          description="Esta acción anulará la orden y revertirá los movimientos de stock si estaba confirmada. ¿Confirmás?"
          confirmLabel="Anular"
          loading={anulando}
          onConfirm={handleAnular}
          onCancel={() => setShowAnular(false)}
        />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODO FORMULARIO (nueva / borrador)
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-4xl">

      {/* Barra sticky */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => { router.refresh(); router.push('/dashboard/ventas/ordenes') }}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-base font-semibold text-gray-900 truncate">
            {isNew ? 'Nueva orden de venta' : `Editar ${orden?.numero ?? ''}`}
          </h2>
          {sucursalNombre && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200 shrink-0 hidden sm:inline">
              {sucursalNombre}
            </span>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => { router.refresh(); router.push('/dashboard/ventas/ordenes') }}>
            <X className="w-4 h-4 mr-1.5" /> Cancelar
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || confirming}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </Button>
          <Button size="sm" onClick={() => setShowConfirmar(true)} disabled={saving || confirming || items.length === 0}>
            <CheckCircle className="w-4 h-4 mr-1.5" />
            Confirmar
          </Button>
        </div>
      </div>

      <div className="space-y-5">

        {/* ── Datos de la orden ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Datos de la orden</h3>
          <div className="grid grid-cols-2 gap-4">

            {/* Cliente */}
            <div className="col-span-2 space-y-1">
              <Label>Cliente</Label>
              <ClienteSearch value={cliente} onChange={setCliente} />
            </div>

            {/* Condición de pago */}
            <div className="space-y-1">
              <Label>Condición de pago</Label>
              <Select value={condicionPago} onValueChange={(v) => { if (v) setCondicionPago(v as CondicionPago) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDICIONES.map(c => (
                    <SelectItem key={c} value={c}>{CONDICION_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha */}
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>

            {/* Vencimiento */}
            <div className="space-y-1">
              <Label>Vencimiento</Label>
              <Input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
            </div>

            {/* Observaciones */}
            <div className="space-y-1">
              <Label>Observaciones</Label>
              <textarea
                rows={2}
                placeholder="Notas internas, condiciones especiales…"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>

          </div>
        </section>

        {/* ── Artículos ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Artículos</h3>

          {/* Selector lista de precios */}
          {listas.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500 shrink-0">Lista de precios:</span>
              <select
                className="h-8 text-sm border border-input rounded-md px-2 bg-white"
                value={listaId ?? ''}
                onChange={e => setListaId(Number(e.target.value) || null)}
              >
                {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>
          )}

          {/* Buscador */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="Buscar artículo por nombre, código o barras…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setShowSearch(true) }}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => { setShowSearch(false); setExpandingId(null) }, 200)}
            />
            {showSearch && searchResults.length > 0 && (
              <div className="absolute z-30 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 overflow-hidden">
                {searchResults.map(a => (
                  <div key={a.id}>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); handleSelectArticulo(a) }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{a.nombre}</p>
                        {a.codigo && <p className="text-xs text-gray-400 font-mono">{a.codigo}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">
                          {a.precio_venta != null ? formatARS(a.precio_venta) : <span className="text-gray-400">Sin precio</span>}
                        </p>
                        <p className="text-xs text-gray-400">Stock: {a.stock_actual}</p>
                      </div>
                      {a.tipo_articulo === 'con_variantes' && (
                        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expandingId === a.id ? 'rotate-180' : ''}`} />
                      )}
                    </button>
                    {a.tipo_articulo === 'con_variantes' && expandingId === a.id && (
                      <div className="border-t border-gray-100 bg-gray-50">
                        <p className="text-xs font-medium text-gray-500 px-4 py-1.5">Seleccioná una variante:</p>
                        {(variantesCache[a.id] ?? []).map(v => (
                          <button
                            key={v.id}
                            onMouseDown={(e) => { e.preventDefault(); addItem(a, v) }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex justify-between text-sm"
                          >
                            <span>{varLabel(v)}</span>
                            <span className="text-gray-500 text-xs">
                              {v.precio_venta != null ? formatARS(v.precio_venta) : '—'} · Stock: {v.stock_actual}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla de ítems */}
          {items.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
              Buscá un artículo para agregarlo
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border border-gray-200 rounded-t-lg">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-600">Artículo</th>
                    <th className="text-center px-3 py-2.5 font-medium text-gray-600 w-28">Cantidad</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-600 w-32">Precio unit.</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-600 w-20">Desc.%</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-600 w-28">Subtotal</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 border-x border-b border-gray-200">
                  {items.map(item => {
                    const sub = Math.round(item.cantidad * item.precio_unitario * (1 - item.descuento_pct / 100) * 100) / 100
                    return (
                      <tr key={item.key}>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-800">{item.nombre_articulo}</p>
                          {item.descripcion_variante && (
                            <p className="text-xs text-gray-400">{item.descripcion_variante}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number" min="0.001" step="1"
                            className="w-full text-center text-sm border border-gray-200 rounded px-2 py-1"
                            value={item.cantidad}
                            onChange={(e) => updateItem(item.key, 'cantidad', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number" min="0" step="0.01"
                            className="w-full text-right text-sm border border-gray-200 rounded px-2 py-1"
                            value={item.precio_unitario}
                            onChange={(e) => updateItem(item.key, 'precio_unitario', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number" min="0" max="100" step="0.5"
                            className="w-full text-right text-sm border border-gray-200 rounded px-2 py-1"
                            value={item.descuento_pct}
                            onChange={(e) => updateItem(item.key, 'descuento_pct', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-800">
                          {formatARS(sub)}
                        </td>
                        <td className="pr-1">
                          <button
                            onClick={() => setItems(prev => prev.filter(i => i.key !== item.key))}
                            className="text-gray-300 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Totales */}
          {items.length > 0 && (
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">{formatARS(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm gap-3">
                  <span className="text-gray-500 shrink-0">Descuento (%)</span>
                  <input
                    type="number" min="0" max="100" step="0.5"
                    className="w-16 text-right text-sm border border-gray-200 rounded px-2 py-0.5"
                    value={descuentoGlobal}
                    onChange={(e) => setDescuentoGlobal(e.target.value)}
                  />
                </div>
                {descMonto > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Descuento</span>
                    <span className="text-red-500">-{formatARS(descMonto)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2">
                  <span>Total</span>
                  <span>{formatARS(total)}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Forma de pago ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Forma de pago</h3>
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setPagos(prev => [...prev, { metodo: 'TRANSFERENCIA', monto: diferenciaPago > 0 ? diferenciaPago.toFixed(2) : '', referencia: '', fecha_pago: '' }])}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Agregar
            </Button>
          </div>

          {pagos.length === 0 ? (
            <p className="text-sm text-gray-400">Sin forma de pago especificada (opcional al crear la orden).</p>
          ) : (
            <div className="space-y-3">
              {pagos.map((pago, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="grid grid-cols-[1fr_130px_150px_130px_auto] gap-2 items-center">
                    <select
                      className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
                      value={pago.metodo}
                      onChange={(e) => setPagos(prev => prev.map((p, i) => i === idx ? { ...p, metodo: e.target.value as MetodoPagoOrden, nota_credito_id: undefined } : p))}
                    >
                      {METODOS.map(m => <option key={m} value={m}>{METODO_ORDEN_LABELS[m]}</option>)}
                    </select>
                    <input
                      type="number" min="0" step="0.01" placeholder="Monto"
                      className="text-sm border border-gray-200 rounded-md px-2 py-1.5 text-right"
                      value={pago.monto}
                      onChange={(e) => setPagos(prev => prev.map((p, i) => i === idx ? { ...p, monto: e.target.value } : p))}
                    />
                    {pago.metodo !== 'NOTA_CREDITO' ? (
                      <>
                        <input
                          type="text" placeholder="Referencia (opcional)"
                          className="text-sm border border-gray-200 rounded-md px-2 py-1.5"
                          value={pago.referencia}
                          onChange={(e) => setPagos(prev => prev.map((p, i) => i === idx ? { ...p, referencia: e.target.value } : p))}
                        />
                        <input
                          type="date" placeholder="Fecha pago"
                          className="text-sm border border-gray-200 rounded-md px-2 py-1.5"
                          value={pago.fecha_pago}
                          onChange={(e) => setPagos(prev => prev.map((p, i) => i === idx ? { ...p, fecha_pago: e.target.value } : p))}
                        />
                      </>
                    ) : (
                      <div className="col-span-2" />
                    )}
                    <button onClick={() => setPagos(prev => prev.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-500 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {pago.metodo === 'NOTA_CREDITO' && (
                    <div className="ml-0">
                      {!cliente ? (
                        <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                          Seleccioná un cliente para ver sus notas de crédito
                        </p>
                      ) : ncsDisponibles.length === 0 ? (
                        <p className="text-xs text-gray-400 bg-gray-50 rounded px-2 py-1">
                          El cliente no tiene notas de crédito disponibles
                        </p>
                      ) : (
                        <select
                          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
                          value={pago.nota_credito_id ? String(pago.nota_credito_id) : ''}
                          onChange={(e) => {
                            const nc = ncsDisponibles.find(n => String(n.id) === e.target.value)
                            setPagos(prev => prev.map((p, i) => {
                              if (i !== idx) return p
                              if (!nc) return { ...p, nota_credito_id: undefined, monto: '' }
                              const otrosPagados = prev.filter((_, j) => j !== idx).reduce((acc, p2) => acc + (parseFloat(p2.monto) || 0), 0)
                              const restante = Math.max(0, total - otrosPagados)
                              const monto = Math.min(nc.monto_disponible, restante)
                              return { ...p, nota_credito_id: nc.id, monto: monto.toFixed(2) }
                            }))
                          }}
                        >
                          <option value="">Seleccioná una nota de crédito…</option>
                          {ncsDisponibles.map(nc => (
                            <option key={nc.id} value={String(nc.id)}>
                              {nc.numero} — {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(nc.monto_disponible)} disp.
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Diálogo confirmar */}
      <ConfirmDialog
        open={showConfirmar}
        title="Confirmar orden"
        description={`Se va a confirmar la orden por ${formatARS(total)}. Esto actualizará el stock de los artículos. ¿Confirmás?`}
        confirmLabel={confirming ? 'Confirmando…' : 'Confirmar'}
        loading={confirming}
        onConfirm={handleConfirmar}
        onCancel={() => setShowConfirmar(false)}
      />
    </div>
  )
}
