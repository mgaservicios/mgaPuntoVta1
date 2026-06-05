'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Search, X, Plus, Minus, Trash2, CheckCircle, ChevronDown, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CajaSesion, MetodoPago } from '@/types/ventas'
import type { Cliente } from '@/types/clientes'
import type { NotaCredito } from '@/types/notas-credito'
import ClienteSearch from '@/components/dashboard/ClienteSearch'
import VarianteSelector from '../_components/VarianteSelector'

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface ArticuloResult {
  id: number
  codigo: string | null
  nombre: string
  tipo_articulo: 'simple' | 'con_variantes'
  precio_venta: number | null
  stock_actual: number
  imagen_url: string | null
}

interface VarianteResult {
  id: number
  sku: string | null
  precio_venta: number | null
  stock_actual: number
  variante_atributos?: { valor: string; atributo_tipos?: { nombre: string } | null }[]
}

interface CartItem {
  key: string
  articulo_id: number
  variante_id: number | null
  nombre: string
  descripcion_variante: string | null
  precio_unitario: number
  cantidad: number
  descuento_pct: number
}

interface PagoLine {
  metodo: MetodoPago
  monto: string
  nota_credito_id?: number
}

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA_DEBITO', label: 'Tarjeta débito' },
  { value: 'TARJETA_CREDITO', label: 'Tarjeta crédito' },
  { value: 'CUENTA_CORRIENTE', label: 'Cuenta corriente' },
  { value: 'NOTA_CREDITO', label: 'Nota de crédito' },
  { value: 'OTRO', label: 'Otro' },
]

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function varianteLabel(v: VarianteResult) {
  const attrs = v.variante_atributos ?? []
  if (attrs.length === 0) return v.sku ?? `Variante #${v.id}`
  return attrs.map(a => `${a.atributo_tipos?.nombre ?? ''}: ${a.valor}`).join(' / ')
}

// ── Página principal POS ──────────────────────────────────────────────────────

async function getPrecioLista(articuloId: number, listaId: number, varianteId?: number | null): Promise<number | null> {
  try {
    const url = `/api/dashboard/articulos/${articuloId}/precios${varianteId ? `?variante_id=${varianteId}` : ''}`
    const res = await fetch(url)
    const data = await res.json()
    const pv = (data.vigentes ?? []).find((p: { lista_precio_id: number; precio_calculado?: number; precio: number }) => p.lista_precio_id === listaId)
    return pv ? (pv.precio_calculado ?? pv.precio) : null
  } catch { return null }
}

export default function POSPage() {
  const router = useRouter()
  const [cajaSesion, setCajaSesion] = useState<CajaSesion | null | undefined>(undefined)

  // Listas de precio
  const [listas, setListas] = useState<{ id: number; nombre: string }[]>([])
  const [listaId, setListaId] = useState<number | null>(null)
  const listaIdRef = useRef<number | null>(null)
  useEffect(() => { listaIdRef.current = listaId }, [listaId])

  // Búsqueda de artículos
  const [q, setQ] = useState('')
  const [searchResults, setSearchResults] = useState<ArticuloResult[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [expandedArticulo, setExpandedArticulo] = useState<number | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Carrito
  const [cart, setCart] = useState<CartItem[]>([])

  // Venta
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [descuentoGlobal, setDescuentoGlobal] = useState('0')
  const [observaciones, setObservaciones] = useState('')
  const [pagos, setPagos] = useState<PagoLine[]>([{ metodo: 'EFECTIVO', monto: '' }])
  const [submitting, setSubmitting] = useState(false)

  // Notas de crédito disponibles para el cliente seleccionado
  const [ncsDisponibles, setNcsDisponibles] = useState<NotaCredito[]>([])

  // Diálogo post-venta: ¿imprimir?
  const [ventaGuardada, setVentaGuardada] = useState<{ id: number; numero: string } | null>(null)

  // Cargar sesión de caja
  useEffect(() => {
    fetch('/api/dashboard/caja/sesion')
      .then(r => r.json())
      .then(data => setCajaSesion(data))
  }, [])

  // Cargar listas de precio de venta
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

  // Cargar NCs cuando cambia el cliente
  useEffect(() => {
    if (!cliente) { setNcsDisponibles([]); return }
    fetch(`/api/dashboard/notas-credito?cliente_id=${cliente.id}&estado=pendiente`)
      .then(r => r.json())
      .then(data => setNcsDisponibles(Array.isArray(data) ? data : []))
      .catch(() => setNcsDisponibles([]))
  }, [cliente])

  // Si se quita el cliente, limpiar NC de los pagos
  useEffect(() => {
    if (!cliente) {
      setPagos(prev => prev.map(p =>
        p.metodo === 'NOTA_CREDITO' ? { metodo: 'EFECTIVO', monto: '' } : p
      ))
    }
  }, [cliente])

  // Búsqueda de artículos
  const buscar = useCallback((texto: string) => {
    clearTimeout(debounce.current)
    if (!texto.trim()) { setSearchResults([]); return }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/dashboard/articulos?q=${encodeURIComponent(texto)}`)
      const data = await res.json()
      const results: ArticuloResult[] = Array.isArray(data) ? data.slice(0, 10) : []
      const lId = listaIdRef.current
      if (lId && results.length > 0) {
        const prices = await Promise.all(results.map(a => getPrecioLista(a.id, lId)))
        setSearchResults(results.map((a, i) => prices[i] != null ? { ...a, precio_venta: prices[i] } : a))
      } else {
        setSearchResults(results)
      }
    }, 250)
  }, [])

  useEffect(() => { buscar(q) }, [q, buscar])
  // Re-enriquecer precios cuando cambia la lista mientras el dropdown está abierto
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (q.trim()) buscar(q) }, [listaId])

  async function addToCart(articulo: ArticuloResult, variante?: VarianteResult) {
    const key = variante ? `a${articulo.id}-v${variante.id}` : `a${articulo.id}`
    let precio = variante?.precio_venta ?? articulo.precio_venta ?? 0
    if (listaId) {
      const lp = await getPrecioLista(articulo.id, listaId, variante?.id)
      if (lp != null) precio = lp
    }
    const descripcion = variante ? varianteLabel(variante) : null

    setCart(prev => {
      const existing = prev.find(i => i.key === key)
      if (existing) {
        return prev.map(i => i.key === key ? { ...i, cantidad: i.cantidad + 1 } : i)
      }
      return [...prev, {
        key,
        articulo_id: articulo.id,
        variante_id: variante?.id ?? null,
        nombre: articulo.nombre,
        descripcion_variante: descripcion,
        precio_unitario: precio,
        cantidad: 1,
        descuento_pct: 0,
      }]
    })

    setQ('')
    setSearchResults([])
    setShowSearch(false)
    setExpandedArticulo(null)
  }

  function handleSelectArticulo(articulo: ArticuloResult) {
    if (articulo.tipo_articulo === 'con_variantes') {
      setExpandedArticulo(prev => prev === articulo.id ? null : articulo.id)
    } else {
      addToCart(articulo)
    }
  }

  function updateCantidad(key: string, delta: number) {
    setCart(prev => prev.map(i => i.key === key
      ? { ...i, cantidad: Math.max(1, i.cantidad + delta) }
      : i
    ))
  }

  function setCantidad(key: string, val: string) {
    const n = parseFloat(val)
    if (!isNaN(n) && n > 0) {
      setCart(prev => prev.map(i => i.key === key ? { ...i, cantidad: n } : i))
    }
  }

  function setPrecio(key: string, val: string) {
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 0) {
      setCart(prev => prev.map(i => i.key === key ? { ...i, precio_unitario: n } : i))
    }
  }

  function removeFromCart(key: string) {
    setCart(prev => prev.filter(i => i.key !== key))
  }

  // Totales
  const subtotal = cart.reduce((acc, i) => acc + i.cantidad * i.precio_unitario * (1 - i.descuento_pct / 100), 0)
  const descPct = parseFloat(descuentoGlobal) || 0
  const descMonto = subtotal * (descPct / 100)
  const total = subtotal - descMonto

  // Sinc pago efectivo al total cuando hay un solo pago
  function syncPagos(t: number) {
    setPagos(prev => {
      if (prev.length === 1) return [{ ...prev[0], monto: t.toFixed(2) }]
      return prev
    })
  }

  useEffect(() => { syncPagos(total) }, [total]) // eslint-disable-line react-hooks/exhaustive-deps

  function addPago() {
    const usados = new Set(pagos.map(p => p.metodo))
    const disponible = METODOS.find(m => !usados.has(m.value))
    if (!disponible) return
    setPagos(prev => [...prev, { metodo: disponible.value, monto: '' }])
  }

  function removePago(idx: number) {
    setPagos(prev => prev.filter((_, i) => i !== idx))
  }

  function updatePago(idx: number, field: 'metodo' | 'monto', value: string) {
    setPagos(prev => prev.map((p, i) => {
      if (i !== idx) return p
      if (field === 'metodo') return { metodo: value as MetodoPago, monto: p.monto, nota_credito_id: undefined }
      return { ...p, monto: value }
    }))
  }

  function selectNC(idx: number, ncId: string) {
    const nc = ncsDisponibles.find(n => String(n.id) === ncId)
    setPagos(prev => prev.map((p, i) => {
      if (i !== idx) return p
      if (!nc) return { ...p, nota_credito_id: undefined, monto: '' }
      const otrosPagados = prev.filter((_, j) => j !== idx).reduce((acc, p2) => acc + (parseFloat(p2.monto) || 0), 0)
      const restante = Math.max(0, total - otrosPagados)
      const monto = Math.min(nc.monto_disponible, restante)
      return { ...p, nota_credito_id: nc.id, monto: monto.toFixed(2) }
    }))
  }

  const totalPagado = pagos.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0)
  const vuelto = pagos.some(p => p.metodo === 'EFECTIVO') ? totalPagado - total : 0

  async function handleSubmit() {
    if (cart.length === 0) { toast.error('Agregá al menos un artículo'); return }
    if (totalPagado < total - 0.005) { toast.error('El monto pagado no cubre el total'); return }

    const pagoCC = pagos.find(p => p.metodo === 'CUENTA_CORRIENTE')
    if (pagoCC && !cliente) { toast.error('Seleccioná un cliente para usar cuenta corriente'); return }

    const pagoNC = pagos.find(p => p.metodo === 'NOTA_CREDITO')
    if (pagoNC && !pagoNC.nota_credito_id) { toast.error('Seleccioná una nota de crédito'); return }

    setSubmitting(true)
    const res = await fetch('/api/dashboard/ventas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: cliente?.id ?? null,
        descuento_pct: descPct,
        observaciones: observaciones || null,
        items: cart.map(i => ({
          articulo_id: i.articulo_id,
          variante_id: i.variante_id,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          descuento_pct: i.descuento_pct,
        })),
        pagos: pagos
          .filter(p => parseFloat(p.monto) > 0)
          .map(p => ({
            metodo: p.metodo,
            monto: parseFloat(p.monto),
            ...(p.nota_credito_id ? { nota_credito_id: p.nota_credito_id } : {}),
          })),
      }),
    })
    setSubmitting(false)

    if (res.ok) {
      const data = await res.json()
      toast.success(`Venta ${data.numero} registrada`)
      setVentaGuardada({ id: data.id, numero: data.numero })
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al registrar la venta')
    }
  }

  function limpiarCarrito() {
    setCart([])
    setCliente(null)
    setDescuentoGlobal('0')
    setPagos([{ metodo: 'EFECTIVO', monto: '' }])
    setObservaciones('')
  }

  if (cajaSesion === undefined) return <div className="text-gray-400 text-sm">Cargando…</div>

  // ── POS ──

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">

      {/* ── Diálogo post-venta: imprimir ── */}
      {ventaGuardada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-800">Venta {ventaGuardada.numero} registrada</p>
              <p className="text-sm text-gray-500 mt-1">¿Deseás imprimir el ticket?</p>
            </div>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setVentaGuardada(null)
                  limpiarCarrito()
                }}
              >
                No, continuar
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  window.open(`/dashboard/ventas/${ventaGuardada.id}/print`, '_blank')
                  setVentaGuardada(null)
                  limpiarCarrito()
                }}
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Imprimir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Columna izquierda: búsqueda + carrito ── */}
      <div className="flex-1 flex flex-col min-w-0 gap-4">

        {/* Selector de lista de precios */}
        {listas.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 shrink-0">Lista de precios:</span>
            <select
              className="h-8 text-sm border border-input rounded-md px-2 bg-white flex-1"
              value={listaId ?? ''}
              onChange={e => setListaId(Number(e.target.value) || null)}
            >
              {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
        )}

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-10 h-11"
            placeholder="Buscar artículo por nombre, código o barras…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setShowSearch(true) }}
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => { setShowSearch(false); setExpandedArticulo(null) }, 200)}
            autoFocus
          />
          {showSearch && searchResults.length > 0 && (
            <div className="absolute z-30 w-full bg-white border border-gray-200 rounded-xl shadow-xl mt-1 overflow-hidden">
              {searchResults.map(a => (
                <div key={a.id}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); handleSelectArticulo(a) }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{a.nombre}</p>
                      {a.codigo && <p className="text-xs text-gray-400 font-mono">{a.codigo}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium text-gray-800">
                        {a.precio_venta != null ? formatARS(a.precio_venta) : <span className="text-gray-400">Sin precio</span>}
                      </p>
                      <p className="text-xs text-gray-400">Stock: {a.stock_actual}</p>
                    </div>
                    {a.tipo_articulo === 'con_variantes' && (
                      <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expandedArticulo === a.id ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                  {a.tipo_articulo === 'con_variantes' && expandedArticulo === a.id && (
                    <VarianteSelector
                      articulo={a}
                      onSelect={(v) => addToCart(a, v)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Carrito */}
        <div className="flex-1 overflow-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <span className="text-4xl">🛒</span>
              <p className="text-sm">Buscá un artículo para agregarlo al carrito</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-gray-600">Artículo</th>
                    <th className="text-center px-3 py-2.5 font-medium text-gray-600 w-28">Cantidad</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-600 w-28">Precio</th>
                    <th className="text-right px-3 py-2.5 font-medium text-gray-600 w-28">Subtotal</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cart.map(item => {
                    const lineTotal = item.cantidad * item.precio_unitario * (1 - item.descuento_pct / 100)
                    return (
                      <tr key={item.key}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-800">{item.nombre}</p>
                          {item.descripcion_variante && (
                            <p className="text-xs text-gray-400">{item.descripcion_variante}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => updateCantidad(item.key, -1)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100">
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              className="w-14 text-center text-sm border border-gray-200 rounded px-1 py-0.5"
                              value={item.cantidad}
                              onChange={(e) => setCantidad(item.key, e.target.value)}
                            />
                            <button onClick={() => updateCantidad(item.key, 1)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-24 text-right text-sm border border-gray-200 rounded px-2 py-0.5"
                            value={item.precio_unitario}
                            onChange={(e) => setPrecio(item.key, e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-gray-800">
                          {formatARS(lineTotal)}
                        </td>
                        <td className="pr-2">
                          <button onClick={() => removeFromCart(item.key)} className="text-gray-300 hover:text-red-500 p-1">
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
        </div>
      </div>

      {/* ── Columna derecha: totales + pago ── */}
      <div className="w-80 shrink-0 flex flex-col gap-3 overflow-auto">

        {/* Cliente */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</p>
          <ClienteSearch value={cliente} onChange={setCliente} />
          {cliente && ncsDisponibles.length > 0 && (
            <p className="text-xs text-green-600">
              {ncsDisponibles.length === 1
                ? `1 nota de crédito disponible (${formatARS(ncsDisponibles.reduce((a, n) => a + n.monto_disponible, 0))})`
                : `${ncsDisponibles.length} notas de crédito disponibles (${formatARS(ncsDisponibles.reduce((a, n) => a + n.monto_disponible, 0))})`
              }
            </p>
          )}
        </div>

        {/* Totales */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Totales</p>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium">{formatARS(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-sm gap-2">
            <span className="text-gray-500 shrink-0">Descuento (%)</span>
            <input
              type="number" min="0" max="100" step="0.5"
              className="w-16 text-right border border-gray-200 rounded px-2 py-0.5 text-sm"
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

          <div className="flex justify-between text-base font-bold border-t border-gray-100 pt-2 mt-1">
            <span>Total</span>
            <span>{formatARS(total)}</span>
          </div>
        </div>

        {/* Pagos */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pagos</p>
            {pagos.length < METODOS.length && (
              <button onClick={addPago} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Agregar
              </button>
            )}
          </div>

          {pagos.map((pago, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex gap-2 items-center">
                <select
                  className="flex-1 text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
                  value={pago.metodo}
                  onChange={(e) => updatePago(idx, 'metodo', e.target.value)}
                >
                  {METODOS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                {pago.metodo !== 'NOTA_CREDITO' && (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="$0"
                    className="w-24 text-right text-sm border border-gray-200 rounded-md px-2 py-1.5"
                    value={pago.monto}
                    onChange={(e) => updatePago(idx, 'monto', e.target.value)}
                  />
                )}
                {pagos.length > 1 && (
                  <button onClick={() => removePago(idx)} className="text-gray-300 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {pago.metodo === 'NOTA_CREDITO' && (
                <div className="space-y-1">
                  {!cliente ? (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                      Seleccioná un cliente para ver sus notas de crédito
                    </p>
                  ) : ncsDisponibles.length === 0 ? (
                    <p className="text-xs text-gray-400 bg-gray-50 rounded px-2 py-1">
                      El cliente no tiene notas de crédito disponibles
                    </p>
                  ) : (
                    <>
                      <select
                        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
                        value={pago.nota_credito_id ? String(pago.nota_credito_id) : ''}
                        onChange={(e) => selectNC(idx, e.target.value)}
                      >
                        <option value="">Seleccioná una nota de crédito…</option>
                        {ncsDisponibles.map(nc => (
                          <option key={nc.id} value={String(nc.id)}>
                            {nc.numero} — {formatARS(nc.monto_disponible)} disp.
                          </option>
                        ))}
                      </select>
                      {pago.nota_credito_id && (
                        <div className="flex gap-2 items-center">
                          <span className="text-xs text-gray-500 shrink-0">Monto a usar:</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="flex-1 text-right text-sm border border-gray-200 rounded-md px-2 py-1.5"
                            value={pago.monto}
                            onChange={(e) => {
                              const nc = ncsDisponibles.find(n => n.id === pago.nota_credito_id)
                              const max = nc ? nc.monto_disponible : Infinity
                              const val = Math.min(parseFloat(e.target.value) || 0, max)
                              updatePago(idx, 'monto', val.toFixed(2))
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="border-t border-gray-100 pt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total pagado</span>
              <span className={`font-medium ${totalPagado < total - 0.005 ? 'text-red-500' : 'text-green-600'}`}>
                {formatARS(totalPagado)}
              </span>
            </div>
            {vuelto > 0.005 && (
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-gray-700">Vuelto</span>
                <span className="text-green-600">{formatARS(vuelto)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Observaciones */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Observaciones</p>
          <textarea
            rows={2}
            placeholder="Opcional…"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        {/* Confirmar */}
        <Button
          size="lg"
          className="w-full"
          disabled={cart.length === 0 || totalPagado < total - 0.005 || submitting}
          onClick={handleSubmit}
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          {submitting ? 'Registrando…' : 'Confirmar venta'}
        </Button>

        {cart.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full text-gray-400" onClick={limpiarCarrito}>
            <X className="w-3.5 h-3.5 mr-1" /> Limpiar carrito
          </Button>
        )}
      </div>
    </div>
  )
}
