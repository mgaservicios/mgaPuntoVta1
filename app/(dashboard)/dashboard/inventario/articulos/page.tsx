'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, Pencil, PowerOff, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { usePermissions } from '@/components/PermissionsProvider'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import type { Articulo } from '@/types/articulos'

type StockEntry = {
  sucursal_id: number
  sucursal_nombre: string
  stock_actual: number
  is_active: boolean
}

type SucursalCol = {
  id: number
  nombre: string
  is_active: boolean
}

type VarianteAtributo = { valor: string; atributo_tipos: { nombre: string } | null }
type VarianteRow = {
  id: number
  sku: string | null
  precio_venta: number | null
  stock_actual: number
  activo: boolean
  variante_atributos: VarianteAtributo[]
  stock_sucursales: StockEntry[]
  precios_vigentes?: PrecioVigenteRow[]
}

type PrecioVigenteRow = {
  lista_id: number
  lista_nombre: string
  tipo: 'manual' | 'calculada'
  precio: number | null
  vigente_desde: string | null
  heredado?: boolean
}

type ArticuloRow = Pick<Articulo, 'id' | 'codigo' | 'nombre' | 'tipo_articulo' | 'precio_venta' | 'stock_actual' | 'activo'> & {
  categorias?: { id: number; nombre: string } | null
  articulo_variantes?: VarianteRow[]
  stock_sucursales: StockEntry[]
  precios_vigentes?: PrecioVigenteRow[]
}

type ListaCol = { id: number; nombre: string; tipo: 'manual' | 'calculada' }

function formatPrecio(v: number | null) {
  if (v == null) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v)
}

function varianteDesc(v: VarianteRow): string {
  if (!v.variante_atributos?.length) return v.sku ?? `Variante #${v.id}`
  return v.variante_atributos.map(a => `${a.atributo_tipos?.nombre ?? ''}: ${a.valor}`).join(' / ')
}

function stockClass(stock: number, isActive: boolean): string {
  if (stock <= 0) return isActive ? 'text-red-600 font-semibold' : 'text-red-300'
  return isActive ? 'text-gray-900 font-medium' : 'text-gray-400 text-xs'
}

export default function ArticulosPage() {
  const { can } = usePermissions()
  const [articulos, setArticulos] = useState<ArticuloRow[]>([])
  const [sucursales, setSucursales] = useState<SucursalCol[]>([])
  const [listas, setListas] = useState<ListaCol[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [soloConStock, setSoloConStock] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [desactivando, setDesactivando] = useState(false)

  const fetchArticulos = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ activo: 'false' })
    if (q) params.set('q', q)
    if (soloConStock && !q) params.set('con_stock', 'true')
    const res = await fetch(`/api/dashboard/articulos?${params}`)
    const data: ArticuloRow[] = await res.json()

    // Derive unique sucursales from the returned stock data (active sucursal first)
    const sucMap = new Map<number, SucursalCol>()
    for (const a of data) {
      for (const s of (a.stock_sucursales ?? [])) {
        if (!sucMap.has(s.sucursal_id)) {
          sucMap.set(s.sucursal_id, { id: s.sucursal_id, nombre: s.sucursal_nombre, is_active: s.is_active })
        }
      }
      for (const v of (a.articulo_variantes ?? [])) {
        for (const s of (v.stock_sucursales ?? [])) {
          if (!sucMap.has(s.sucursal_id)) {
            sucMap.set(s.sucursal_id, { id: s.sucursal_id, nombre: s.sucursal_nombre, is_active: s.is_active })
          }
        }
      }
    }
    const sucList = Array.from(sucMap.values()).sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
      return a.nombre.localeCompare(b.nombre, 'es')
    })

    // Derive unique listas from precios_vigentes (max 3)
    const listaMap = new Map<number, ListaCol>()
    for (const a of data) {
      for (const pv of (a.precios_vigentes ?? [])) {
        if (!listaMap.has(pv.lista_id)) {
          listaMap.set(pv.lista_id, { id: pv.lista_id, nombre: pv.lista_nombre, tipo: pv.tipo })
        }
      }
    }
    setListas(Array.from(listaMap.values()).slice(0, 3))

    setSucursales(sucList)
    setArticulos(data)
    setLoading(false)
  }, [q, soloConStock])

  useEffect(() => {
    const t = setTimeout(fetchArticulos, 300)
    return () => clearTimeout(t)
  }, [fetchArticulos])


  async function handleDesactivar() {
    if (!confirmId) return
    setDesactivando(true)
    const res = await fetch(`/api/dashboard/articulos/${confirmId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Artículo desactivado')
      setArticulos((prev) =>
        prev.map((a) => a.id === confirmId ? { ...a, activo: false } : a)
      )
    } else {
      toast.error('Error al desactivar')
    }
    setDesactivando(false)
    setConfirmId(null)
  }

  const colCount = 7
  const activeSuc = sucursales.find(s => s.is_active) ?? null
  const mainLista = listas[0] ?? null

  // When no search text: API already filtered by stock server-side.
  // When search text is active: filter client-side from RPC results.
  const articulosFiltrados = soloConStock && activeSuc && q.trim()
    ? articulos.filter(a => {
        if (a.tipo_articulo === 'con_variantes') {
          return (a.articulo_variantes ?? []).some(v =>
            (v.stock_sucursales?.find(s => s.sucursal_id === activeSuc.id)?.stock_actual ?? 0) > 0
          )
        }
        return (a.stock_sucursales?.find(s => s.sucursal_id === activeSuc.id)?.stock_actual ?? 0) > 0
      })
    : articulos

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, código o barras…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={soloConStock}
              onChange={e => setSoloConStock(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Con stock
          </label>
        </div>
        {can('inventario.articulos.crear') && (
          <Link href="/dashboard/inventario/articulos/nuevo" className={buttonVariants()}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo artículo
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre / Variante</TableHead>
              <TableHead className="w-28">Código / SKU</TableHead>
              <TableHead className="w-24">Categoría</TableHead>
              <TableHead className="text-right w-32">
                {mainLista ? mainLista.nombre : 'Precio'}
              </TableHead>
              <TableHead className="text-right w-24">
                {activeSuc ? `Stock ${activeSuc.nombre}` : 'Stock'}
              </TableHead>
              <TableHead className="w-20">Estado</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-8 text-gray-400">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : articulos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-8 text-gray-400">
                  No hay artículos
                </TableCell>
              </TableRow>
            ) : (
              articulosFiltrados.flatMap((a) => {
                const mainRow = (
                  <TableRow key={`art-${a.id}`} className={!a.activo ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{a.nombre}</TableCell>
                    <TableCell className="text-gray-500 font-mono text-xs">{a.codigo ?? '—'}</TableCell>
                    <TableCell className="text-gray-500 text-sm truncate max-w-[96px]">
                      <div>{a.categorias?.nombre ?? '—'}</div>
                      {a.tipo_articulo === 'con_variantes' && (
                        <span className="flex items-center gap-1 text-purple-600 text-xs font-medium mt-0.5">
                          <Layers className="w-3 h-3" /> Con variantes
                        </span>
                      )}
                    </TableCell>
                    {/* Single price column */}
                    <TableCell className="text-right tabular-nums">
                      {a.tipo_articulo === 'con_variantes'
                        ? <span className="text-gray-300">—</span>
                        : formatPrecio(mainLista
                            ? (a.precios_vigentes?.find(p => p.lista_id === mainLista.id)?.precio ?? null)
                            : null)
                      }
                    </TableCell>
                    {/* Single stock column (active sucursal) */}
                    <TableCell className="text-right tabular-nums">
                      {a.tipo_articulo === 'con_variantes'
                        ? <span className="text-gray-300">—</span>
                        : (() => {
                            const stock = activeSuc
                              ? (a.stock_sucursales?.find(e => e.sucursal_id === activeSuc.id)?.stock_actual ?? 0)
                              : 0
                            return <span className={stockClass(stock, !!activeSuc)}>{stock}</span>
                          })()
                      }
                    </TableCell>

                    <TableCell>
                      <Badge variant={a.activo ? 'default' : 'secondary'}>
                        {a.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Link
                          href={`/dashboard/inventario/articulos/${a.id}`}
                          title="Ver / Editar"
                          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {can('inventario.articulos.editar') && (
                          <Link
                            href={`/dashboard/inventario/articulos/${a.id}`}
                            title="Editar"
                            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                        )}
                        {a.activo && can('inventario.articulos.desactivar') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => setConfirmId(a.id)}
                          >
                            <PowerOff className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )

                const variantRows = (a.tipo_articulo === 'con_variantes' && a.articulo_variantes?.length)
                  ? a.articulo_variantes.map((v) => (
                    <TableRow key={`var-${v.id}`} className="bg-gray-50/70 hover:bg-gray-100/50">
                      <TableCell className="py-2 pl-8 text-sm text-gray-700">
                        <span className="text-gray-300 mr-1.5 select-none">└</span>
                        {varianteDesc(v)}
                      </TableCell>
                      <TableCell className="py-2 text-gray-400 font-mono text-xs">{v.sku ?? '—'}</TableCell>
                      <TableCell className="py-2 text-gray-400 text-xs">Variante</TableCell>
                      {/* Variant price */}
                      <TableCell className="py-2 text-right tabular-nums text-sm">
                        {(() => {
                          const pv = mainLista ? v.precios_vigentes?.find(p => p.lista_id === mainLista.id) : null
                          return <span className={pv?.heredado ? 'text-gray-400' : 'font-medium'}>{formatPrecio(pv?.precio ?? null)}</span>
                        })()}
                      </TableCell>
                      {/* Variant stock (active sucursal) */}
                      <TableCell className="py-2 text-right tabular-nums">
                        {(() => {
                          const stock = activeSuc
                            ? (v.stock_sucursales?.find(e => e.sucursal_id === activeSuc.id)?.stock_actual ?? 0)
                            : 0
                          return <span className={stockClass(stock, !!activeSuc)}>{stock}</span>
                        })()}
                      </TableCell>

                      <TableCell className="py-2">
                        <Badge variant={v.activo ? 'default' : 'secondary'} className="text-xs">
                          {v.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2" />
                    </TableRow>
                  ))
                  : []

                return [mainRow, ...variantRows]
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="Desactivar artículo"
        description="El artículo quedará inactivo y no aparecerá en el punto de venta. Podés reactivarlo editándolo."
        confirmLabel="Desactivar"
        loading={desactivando}
        onConfirm={handleDesactivar}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
