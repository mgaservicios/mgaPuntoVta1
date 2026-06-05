'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw } from 'lucide-react'

type StockEntry = {
  sucursal_id: number
  sucursal_nombre: string
  stock_actual: number
  is_active: boolean
}

type VarianteAtributo = { valor: string; atributo_tipos: { nombre: string } | null }

type PrecioVigente = { lista_id: number; lista_nombre: string; tipo: string; categoria: string; precio: number | null }

type VarianteData = {
  id: number
  sku: string | null
  precio_venta: number | null
  activo: boolean
  variante_atributos: VarianteAtributo[]
  stock_sucursales: StockEntry[]
  precios_vigentes?: PrecioVigente[]
}

type ArticuloData = {
  id: number
  codigo: string | null
  nombre: string
  tipo_articulo: 'simple' | 'con_variantes'
  precio_venta: number | null
  activo: boolean
  articulo_variantes: VarianteData[]
  stock_sucursales: StockEntry[]
  precios_vigentes?: PrecioVigente[]
}

function getPrecioVenta(precios: PrecioVigente[] | undefined, fallback: number | null): number | null {
  if (!precios?.length) return fallback
  const venta = precios.find(p => p.lista_id === 2 && p.precio != null && p.precio > 0)
  return venta?.precio ?? fallback
}

type SucursalCol = { id: number; nombre: string; isActive: boolean }

type DisplayRow = {
  key: string
  isParent: boolean
  isVariante: boolean
  codigo: string | null
  nombre: string
  varianteDesc: string | null
  precio: number | null
  stockSucursales: StockEntry[]
}

function varianteLabel(v: VarianteData): string {
  if (v.variante_atributos?.length) {
    return v.variante_atributos.map(a => `${a.atributo_tipos?.nombre ?? ''}: ${a.valor}`).join(' / ')
  }
  return v.sku ?? '—'
}

function formatPrecio(v: number | null) {
  if (v == null) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v)
}

export default function ConsultaStockPage() {
  const [articulos, setArticulos] = useState<ArticuloData[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    const res = await fetch(`/api/dashboard/articulos?${params}`)
    const data = await res.json()
    setArticulos(Array.isArray(data) ? data : [])
    setLastUpdate(new Date())
    setLoading(false)
  }, [q])

  useEffect(() => {
    const t = setTimeout(fetchData, 300)
    return () => clearTimeout(t)
  }, [fetchData])

  // Sucursal columns derived from data — active first, then alphabetical
  const sucursales: SucursalCol[] = (() => {
    const map = new Map<number, SucursalCol>()
    for (const a of articulos) {
      const all = [
        ...(a.stock_sucursales ?? []),
        ...(a.articulo_variantes ?? []).flatMap(v => v.stock_sucursales ?? []),
      ]
      for (const s of all) {
        if (!map.has(s.sucursal_id)) {
          map.set(s.sucursal_id, { id: s.sucursal_id, nombre: s.sucursal_nombre, isActive: s.is_active })
        }
      }
    }
    return [...map.values()].sort((a, b) => {
      if (a.isActive && !b.isActive) return -1
      if (!a.isActive && b.isActive) return 1
      return a.nombre.localeCompare(b.nombre)
    })
  })()

  const activeSucursalNombre = sucursales.find(s => s.isActive)?.nombre ?? ''

  // Flatten to display rows
  const rows: DisplayRow[] = articulos.flatMap(a => {
    if (a.tipo_articulo === 'con_variantes') {
      const parent: DisplayRow = {
        key: `art-${a.id}`,
        isParent: true,
        isVariante: false,
        codigo: a.codigo,
        nombre: a.nombre,
        varianteDesc: null,
        precio: null,
        stockSucursales: [],
      }
      const variants: DisplayRow[] = (a.articulo_variantes ?? [])
        .filter(v => v.activo)
        .map(v => ({
          key: `var-${v.id}`,
          isParent: false,
          isVariante: true,
          codigo: a.codigo,
          nombre: a.nombre,
          varianteDesc: varianteLabel(v),
          precio: getPrecioVenta(v.precios_vigentes, v.precio_venta),
          stockSucursales: v.stock_sucursales ?? [],
        }))
      return [parent, ...variants]
    }
    return [{
      key: `art-${a.id}`,
      isParent: false,
      isVariante: false,
      codigo: a.codigo,
      nombre: a.nombre,
      varianteDesc: null,
      precio: getPrecioVenta(a.precios_vigentes, a.precio_venta),
      stockSucursales: a.stock_sucursales ?? [],
    }]
  })

  function stockValue(row: DisplayRow, sucursalId: number): number | null {
    if (row.isParent) return null
    const entry = row.stockSucursales.find(s => s.sucursal_id === sucursalId)
    return entry?.stock_actual ?? null
  }

  const colCount = 3 + sucursales.length

  return (
    <div className="flex flex-col h-screen bg-white select-none">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 bg-white px-5 py-3 flex items-center gap-4">
        <div className="flex-shrink-0">
          <h1 className="text-sm font-semibold text-gray-900 leading-tight">Consulta Stock y Precio</h1>
          {activeSucursalNombre && (
            <p className="text-[11px] text-indigo-600 font-medium leading-tight mt-0.5">{activeSucursalNombre}</p>
          )}
        </div>

        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar artículo, código, SKU…"
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            value={q}
            onChange={e => setQ(e.target.value)}
            autoFocus
          />
        </div>

        <div className="ml-auto flex items-center gap-4 text-xs text-gray-400">
          {!loading && <span>{articulos.length} artículos</span>}
          {lastUpdate && (
            <span>Actualizado {lastUpdate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </header>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 shadow-sm">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs whitespace-nowrap w-28">Código</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">Nombre / Variante</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs whitespace-nowrap">Precio</th>
              {sucursales.map(s => (
                <th key={s.id} className="text-right px-4 py-2.5 text-xs whitespace-nowrap min-w-[7rem]">
                  {s.isActive ? (
                    <span className="flex flex-col items-end gap-0.5">
                      <span className="font-semibold text-indigo-700">{s.nombre}</span>
                      <span className="text-[10px] font-normal text-indigo-400">activa</span>
                    </span>
                  ) : (
                    <span className="font-medium text-gray-400">{s.nombre}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colCount} className="text-center py-20 text-gray-400 text-sm">Cargando…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="text-center py-20 text-gray-400 text-sm">Sin resultados</td>
              </tr>
            ) : (
              rows.map(row => (
                <tr
                  key={row.key}
                  className={
                    row.isParent
                      ? 'bg-gray-50/80 border-b border-gray-100'
                      : 'border-b border-gray-100 hover:bg-indigo-50/20 transition-colors'
                  }
                >
                  {/* Código */}
                  <td className="px-4 py-2 font-mono text-xs text-gray-400 whitespace-nowrap">
                    {!row.isVariante ? (row.codigo ?? '—') : ''}
                  </td>

                  {/* Nombre / Variante */}
                  <td className="px-4 py-2">
                    {row.isParent ? (
                      <span className="font-semibold text-gray-700">{row.nombre}</span>
                    ) : row.isVariante ? (
                      <span className="flex items-baseline gap-1">
                        <span className="text-gray-300 text-xs select-none">└</span>
                        <span className="text-xs text-gray-400 mr-0.5">{row.nombre}</span>
                        <span className="text-gray-700">{row.varianteDesc}</span>
                      </span>
                    ) : (
                      <span className="text-gray-900">{row.nombre}</span>
                    )}
                  </td>

                  {/* Precio */}
                  <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                    {row.isParent ? (
                      <span className="text-gray-200 text-xs">—</span>
                    ) : (
                      <span className="font-medium text-gray-800">{formatPrecio(row.precio)}</span>
                    )}
                  </td>

                  {/* Stock por sucursal */}
                  {sucursales.map(s => {
                    const stock = stockValue(row, s.id)
                    return (
                      <td key={s.id} className="px-4 py-2 text-right tabular-nums">
                        {row.isParent || stock === null ? (
                          <span className="text-gray-200 text-xs">—</span>
                        ) : stock <= 0 ? (
                          <span className={`font-semibold ${s.isActive ? 'text-red-600' : 'text-red-300'}`}>0</span>
                        ) : (
                          <span className={s.isActive ? 'font-semibold text-gray-900' : 'text-gray-400 text-xs'}>
                            {stock}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <footer className="flex-shrink-0 border-t border-gray-100 px-5 py-2 bg-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {sucursales.length > 0
            ? `${sucursales.length} sucursal${sucursales.length > 1 ? 'es' : ''}`
            : ''}
        </span>
        <span className="text-xs text-gray-400">Los precios y stock son en tiempo real</span>
      </footer>
    </div>
  )
}
