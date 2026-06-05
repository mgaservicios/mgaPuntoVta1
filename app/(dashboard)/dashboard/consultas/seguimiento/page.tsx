'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Package, Activity, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

type VarianteAtributo = { valor: string; atributo_tipos: { nombre: string } | null }
type VarianteInfo = { sku: string | null; variante_atributos?: VarianteAtributo[] }

type VarianteRow = {
  id: number; sku: string | null; stock_actual: number; activo: boolean
  variante_atributos?: VarianteAtributo[]
}
type ArticuloRow = {
  id: number; codigo: string | null; nombre: string
  tipo_articulo: 'simple' | 'con_variantes'
  stock_actual: number; precio_venta: number | null; activo: boolean
  categorias?: { nombre: string } | null
  articulo_variantes?: VarianteRow[]
}

// Tipo unificado que devuelve la API (combina movimientos_stock + remito_items)
type Movimiento = {
  id: string
  tipo: 'entrada' | 'salida' | 'ajuste' | 'venta' | 'devolucion' | 'orden'
  cantidad: number
  stock_antes: number | null
  stock_despues: number | null
  referencia: string | null
  observaciones: string | null
  fecha: string
  variante_id: number | null
  sucursal: string | null
  variante: VarianteInfo | null
}

const TIPO_CONFIG: Record<string, { label: string; cls: string; negative: boolean }> = {
  venta:      { label: 'Venta',      cls: 'text-blue-700 bg-blue-50 border-blue-200',      negative: true  },
  salida:     { label: 'Salida',     cls: 'text-red-700 bg-red-50 border-red-200',          negative: true  },
  entrada:    { label: 'Entrada',    cls: 'text-green-700 bg-green-50 border-green-200',    negative: false },
  ajuste:     { label: 'Ajuste',     cls: 'text-yellow-700 bg-yellow-50 border-yellow-200', negative: false },
  devolucion: { label: 'Devolución', cls: 'text-purple-700 bg-purple-50 border-purple-200', negative: false },
  orden:      { label: 'Orden',      cls: 'text-orange-700 bg-orange-50 border-orange-200', negative: true  },
}

function formatPrecio(v: number | null) {
  if (v == null) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v)
}

function formatFecha(iso: string) {
  // Handles both DATE ("2026-05-28") and full timestamp
  const d = new Date(iso)
  if (iso.length === 10) {
    // DATE only — show without time
    const [y, m, day] = iso.split('-')
    return `${day}/${m}/${y}`
  }
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function varianteDesc(v: VarianteInfo): string {
  if (v.variante_atributos?.length) {
    return v.variante_atributos.map(a => `${a.atributo_tipos?.nombre ?? ''}: ${a.valor}`).join(' / ')
  }
  return v.sku ?? '—'
}

export default function SeguimientoPage() {
  const [articulos, setArticulos] = useState<ArticuloRow[]>([])
  const [loadingArticulos, setLoadingArticulos] = useState(true)
  const [q, setQ] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loadingMovimientos, setLoadingMovimientos] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const fetchArticulos = useCallback(async () => {
    setLoadingArticulos(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const res = await fetch(`/api/dashboard/articulos/seguimiento?${params}`)
    const data = await res.json()
    setArticulos(Array.isArray(data) ? data : [])
    setLoadingArticulos(false)
  }, [q])


  useEffect(() => {
    const t = setTimeout(fetchArticulos, 300)
    return () => clearTimeout(t)
  }, [fetchArticulos])

  const fetchMovimientos = useCallback(async () => {
    if (!selectedId) { setMovimientos([]); return }
    setLoadingMovimientos(true)
    const params = new URLSearchParams({ articulo_id: String(selectedId) })
    if (dateFrom) params.set('desde', dateFrom)
    if (dateTo) params.set('hasta', dateTo)
    const res = await fetch(`/api/dashboard/articulos/seguimiento?${params}`)
    const data = await res.json()
    setMovimientos(Array.isArray(data) ? data : [])
    setLoadingMovimientos(false)
  }, [selectedId, dateFrom, dateTo])

  useEffect(() => {
    fetchMovimientos()
  }, [fetchMovimientos])

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedArticulo = articulos.find(a => a.id === selectedId)

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar artículo…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <label className="text-sm text-gray-500 whitespace-nowrap">Desde</label>
          <Input type="date" className="w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <label className="text-sm text-gray-500 whitespace-nowrap">Hasta</label>
          <Input type="date" className="w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {/* Grilla superior — Artículos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Artículos y variantes</span>
          {!loadingArticulos && (
            <span className="text-xs text-gray-400">({articulos.length})</span>
          )}
          {selectedArticulo && (
            <span className="ml-auto text-xs text-blue-600 font-medium">
              {selectedArticulo.nombre}
            </span>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Nombre / Variante</TableHead>
                <TableHead>Código / SKU</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Precio venta</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingArticulos ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-400">Cargando…</TableCell>
                </TableRow>
              ) : articulos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-400">No hay artículos</TableCell>
                </TableRow>
              ) : (
                articulos.flatMap((a) => {
                  const isSelected = selectedId === a.id
                  const isExpanded = expandedIds.has(a.id)
                  const hasVariantes = a.tipo_articulo === 'con_variantes' && (a.articulo_variantes?.length ?? 0) > 0

                  const mainRow = (
                    <TableRow
                      key={`art-${a.id}`}
                      className={cn(
                        'cursor-pointer transition-colors',
                        isSelected ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-gray-50'
                      )}
                      onClick={() => setSelectedId(prev => prev === a.id ? null : a.id)}
                    >
                      <TableCell className="py-2 pr-0 pl-3">
                        {hasVariantes && (
                          <button
                            className="p-0.5 rounded text-gray-400 hover:text-gray-600"
                            onClick={(e) => toggleExpand(a.id, e)}
                          >
                            <ChevronRight className={cn('w-3.5 h-3.5 transition-transform duration-150', isExpanded && 'rotate-90')} />
                          </button>
                        )}
                      </TableCell>
                      <TableCell className={cn('font-medium', isSelected && 'text-blue-700')}>
                        {a.nombre}
                      </TableCell>
                      <TableCell className="text-gray-500 font-mono text-xs">{a.codigo ?? '—'}</TableCell>
                      <TableCell className="text-gray-500 text-sm">{a.categorias?.nombre ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {a.tipo_articulo === 'con_variantes' ? '—' : formatPrecio(a.precio_venta)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={a.stock_actual <= 0 ? 'text-red-500 font-medium' : ''}>
                          {a.stock_actual}
                        </span>
                      </TableCell>
                    </TableRow>
                  )

                  const variantRows = (hasVariantes && isExpanded)
                    ? (a.articulo_variantes ?? []).map((v) => (
                      <TableRow key={`var-${v.id}`} className="bg-gray-50/60 hover:bg-gray-100/50">
                        <TableCell className="py-1.5" />
                        <TableCell className="py-1.5 pl-8 text-sm text-gray-600">
                          <span className="text-gray-300 mr-1.5 select-none">└</span>
                          {varianteDesc(v)}
                        </TableCell>
                        <TableCell className="py-1.5 text-gray-400 font-mono text-xs">{v.sku ?? '—'}</TableCell>
                        <TableCell className="py-1.5" />
                        <TableCell className="py-1.5 text-right text-sm text-gray-400">—</TableCell>
                        <TableCell className="py-1.5 text-right">
                          <span className={v.stock_actual <= 0 ? 'text-red-500 font-medium' : ''}>
                            {v.stock_actual}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                    : []

                  return [mainRow, ...variantRows]
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Grilla inferior — Movimientos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            {selectedArticulo
              ? `Movimientos · ${selectedArticulo.nombre}`
              : 'Movimientos'}
          </span>
          {selectedId && !loadingMovimientos && (
            <span className="text-xs text-gray-400">({movimientos.length})</span>
          )}
        </div>

        {!selectedId ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            Hacé clic en un artículo de la tabla superior para ver sus movimientos
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Stock antes</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Stock después</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMovimientos ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-400">Cargando…</TableCell>
                  </TableRow>
                ) : movimientos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-400">
                      Sin movimientos para el período seleccionado
                    </TableCell>
                  </TableRow>
                ) : (
                  movimientos.map((m) => {
                    const cfg = TIPO_CONFIG[m.tipo] ?? { label: m.tipo, cls: 'text-gray-700 bg-gray-50 border-gray-200', negative: false }
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm whitespace-nowrap">{formatFecha(m.fecha)}</TableCell>
                        <TableCell>
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', cfg.cls)}>
                            {cfg.label}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-600">{m.referencia ?? '—'}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {m.variante_id && m.variante
                            ? varianteDesc(m.variante)
                            : <span className="text-gray-400">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{m.sucursal ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          <span className={cfg.negative ? 'text-red-600' : 'text-green-600'}>
                            {cfg.negative ? '-' : '+'}{m.cantidad}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-gray-500 tabular-nums">
                          {m.stock_antes ?? <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums">
                          {m.stock_despues ?? <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                          {m.observaciones ?? <span className="text-gray-300">—</span>}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
