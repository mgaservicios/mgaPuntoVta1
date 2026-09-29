'use client'

import { useState, useEffect, useRef } from 'react'
import { Package } from 'lucide-react'
import { Input } from '@/components/ui/input'

export interface StockSucursal {
  sucursal_id: number
  sucursal_nombre?: string
  stock_actual: number
  is_active: boolean
}

export interface ArticuloResult {
  id: number
  codigo: string | null
  nombre: string
  tipo_articulo: 'simple' | 'con_variantes'
  precio_venta: number | null
  stock_sucursales?: StockSucursal[]
  stock_sucursal_actual?: number
}

export interface VarianteResult {
  id: number
  sku: string | null
  precio_venta: number | null
  activo: boolean
  stock_sucursales?: StockSucursal[]
  stock_sucursal_actual?: number
  variante_atributos?: { valor: string; atributo_tipos?: { nombre: string } | null }[]
}

/** Stock de la sucursal activa. Es el único que se puede descontar con una OT. */
function stockActivo(e: { stock_sucursales?: StockSucursal[]; stock_sucursal_actual?: number }): number {
  if (typeof e.stock_sucursal_actual === 'number') return e.stock_sucursal_actual
  const s = e.stock_sucursales?.find(x => x.is_active)
  return s ? Number(s.stock_actual) : 0
}

export function varLabel(v: VarianteResult) {
  const attrs = v.variante_atributos ?? []
  if (!attrs.length) return v.sku ?? `Var. #${v.id}`
  return attrs.map(a => `${a.atributo_tipos?.nombre ?? ''}: ${a.valor}`).join(' / ')
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

async function getPrecioLista(articuloId: number, listaId: number, varianteId?: number): Promise<number | null> {
  try {
    const url = `/api/dashboard/articulos/${articuloId}/precios${varianteId ? `?variante_id=${varianteId}` : ''}`
    const res = await fetch(url)
    const data = await res.json()
    const pv = (data.vigentes ?? []).find((p: { lista_precio_id: number; precio_calculado?: number; precio: number }) => p.lista_precio_id === listaId)
    return pv ? (pv.precio_calculado ?? pv.precio) : null
  } catch { return null }
}

export default function ArmazonSearch({
  onSelect,
  listaId,
}: {
  onSelect: (a: ArticuloResult, v?: VarianteResult) => void
  listaId?: number | null
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ArticuloResult[]>([])
  const [open, setOpen] = useState(false)
  const [expandingId, setExpandingId] = useState<number | null>(null)
  const [variantesCache, setVariantesCache] = useState<Record<number, VarianteResult[]>>({})
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      // con_stock=true: solo artículos con stock en la sucursal activa.
      // El backend vuelve a validar al guardar, esto es solo para no ofrecer
      // armazones que no se pueden usar.
      const res = await fetch(`/api/dashboard/articulos?con_stock=true&q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data.slice(0, 10) : [])
    }, 250)
  }, [q])

  async function loadVariantes(articuloId: number) {
    if (variantesCache[articuloId]) return
    const res = await fetch(`/api/dashboard/articulos/${articuloId}`)
    const data = await res.json()
    setVariantesCache(prev => ({
      ...prev,
      [articuloId]: (data.articulo_variantes ?? []).filter((v: VarianteResult) => v.activo),
    }))
  }

  async function handleClick(a: ArticuloResult) {
    if (a.tipo_articulo === 'con_variantes') {
      if (expandingId === a.id) { setExpandingId(null); return }
      setExpandingId(a.id)
      await loadVariantes(a.id)
    } else {
      const precio = listaId ? await getPrecioLista(a.id, listaId) : null
      onSelect(precio != null ? { ...a, precio_venta: precio } : a)
      setQ(''); setResults([]); setOpen(false); setExpandingId(null)
    }
  }

  async function handleSelectVariante(a: ArticuloResult, v: VarianteResult) {
    const precio = listaId ? await getPrecioLista(a.id, listaId, v.id) : null
    onSelect(a, precio != null ? { ...v, precio_venta: precio } : v)
    setQ(''); setResults([]); setOpen(false); setExpandingId(null)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Package className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input
          placeholder="Buscar en stock..."
          className="pl-8 h-8 text-sm"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => { setOpen(false); setExpandingId(null) }, 200)}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 top-full mt-1 w-72 bg-white rounded-md border shadow-lg max-h-60 overflow-auto">
          {results.map(a => (
            <div key={a.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                onMouseDown={() => handleClick(a)}
              >
                <span className="truncate">{a.nombre}</span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  {a.tipo_articulo === 'con_variantes' && (
                    <span className="text-xs text-gray-500">{stockActivo(a)} disp.</span>
                  )}
                  {a.precio_venta != null && (
                    <span className="text-xs text-gray-400">{formatARS(a.precio_venta)}</span>
                  )}
                </span>
              </button>
              {expandingId === a.id && variantesCache[a.id] && (
                <div className="border-t bg-gray-50">
                  {variantesCache[a.id].map(v => {
                    const st = stockActivo(v)
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={st <= 0}
                        className="w-full text-left pl-6 pr-3 py-1.5 text-xs hover:bg-blue-50 disabled:hover:bg-transparent disabled:text-gray-400 flex items-center justify-between gap-2"
                        onMouseDown={() => handleSelectVariante(a, v)}
                      >
                        <span>{varLabel(v)}</span>
                        <span className="flex items-center gap-2 flex-shrink-0">
                          <span className={st > 0 ? 'text-gray-500' : 'text-red-500'}>
                            {st} disp.
                          </span>
                          {v.precio_venta != null && <span className="text-gray-400">{formatARS(v.precio_venta)}</span>}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
