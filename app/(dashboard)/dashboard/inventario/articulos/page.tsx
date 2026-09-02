'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, Pencil, PowerOff, Layers, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { usePermissions } from '@/components/PermissionsProvider'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import type { Articulo } from '@/types/articulos'

type VarianteAtributo = { valor: string; atributo_tipos: { nombre: string } | null }
type VarianteRow = {
  id: number
  sku: string | null
  precio_venta: number | null
  stock_actual: number
  activo: boolean
  variante_atributos: VarianteAtributo[]
  precios_vigentes?: PrecioVigenteRow[]
}

type FiltroItem = { id: number; nombre: string }

type PrecioVigenteRow = {
  lista_id: number
  lista_nombre: string
  tipo: 'manual' | 'calculada'
  categoria: 'costo' | 'venta'
  precio: number | null
  vigente_desde: string | null
  heredado?: boolean
}

type ArticuloRow = Pick<Articulo, 'id' | 'codigo' | 'nombre' | 'tipo_articulo' | 'precio_venta' | 'stock_actual' | 'activo'> & {
  categorias?: { id: number; nombre: string } | null
  marcas?: { id: number; nombre: string } | null
  proveedores?: { id: number; nombre: string } | null
  articulo_variantes?: VarianteRow[]
  precios_vigentes?: PrecioVigenteRow[]
}

type ListaCol = { id: number; nombre: string; tipo: 'manual' | 'calculada'; categoria: 'costo' | 'venta' }

const FILTROS_KEY = 'articulos_filtros_v1'
const SCROLL_KEY = 'articulos_scroll_v1'

function loadFiltros(): { q: string; proveedor: string; marca: string; categoria: string } {
  try {
    const raw = localStorage.getItem(FILTROS_KEY)
    if (!raw) return { q: '', proveedor: '', marca: '', categoria: '' }
    const parsed = JSON.parse(raw)
    return {
      q: typeof parsed.q === 'string' ? parsed.q : '',
      proveedor: typeof parsed.proveedor === 'string' ? parsed.proveedor : '',
      marca: typeof parsed.marca === 'string' ? parsed.marca : '',
      categoria: typeof parsed.categoria === 'string' ? parsed.categoria : '',
    }
  } catch {
    return { q: '', proveedor: '', marca: '', categoria: '' }
  }
}

function saveFiltros(f: { q: string; proveedor: string; marca: string; categoria: string }) {
  try {
    localStorage.setItem(FILTROS_KEY, JSON.stringify(f))
  } catch { /* localStorage no disponible */ }
}

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
  const [listas, setListas] = useState<ListaCol[]>([])
  const [loading, setLoading] = useState(true)
  const initialFiltros = useMemo(() => loadFiltros(), [])
  const [q, setQ] = useState(initialFiltros.q)
  const [filtroProveedor, setFiltroProveedor] = useState(initialFiltros.proveedor)
  const [filtroMarca, setFiltroMarca] = useState(initialFiltros.marca)
  const [filtroCategoria, setFiltroCategoria] = useState(initialFiltros.categoria)
  const [proveedoresList, setProveedoresList] = useState<FiltroItem[]>([])
  const [marcasList, setMarcasList] = useState<FiltroItem[]>([])
  const [categoriasList, setCategoriasList] = useState<FiltroItem[]>([])
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [desactivando, setDesactivando] = useState(false)

  // Eliminar permanentemente
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteNombre, setDeleteNombre] = useState('')
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/proveedores').then(r => r.json()),
      fetch('/api/dashboard/marcas').then(r => r.json()),
      fetch('/api/dashboard/categorias').then(r => r.json()),
    ]).then(([provs, marcas, cats]) => {
      setProveedoresList((provs ?? []).filter((p: FiltroItem) => p.nombre))
      setMarcasList((marcas ?? []).filter((m: FiltroItem) => m.nombre))
      setCategoriasList((cats ?? []).filter((c: FiltroItem) => c.nombre))
    })
  }, [])

  // Persistir filtros en localStorage para restaurarlos al volver de editar
  useEffect(() => {
    saveFiltros({ q, proveedor: filtroProveedor, marca: filtroMarca, categoria: filtroCategoria })
  }, [q, filtroProveedor, filtroMarca, filtroCategoria])

  // Guardar posición de scroll antes de navegar a editar/ver
  const guardarScroll = useCallback(() => {
    try {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
    } catch { /* noop */ }
  }, [])

  // Restaurar posición de scroll al volver de editar/ver
  useEffect(() => {
    let raf = 0
    try {
      const saved = sessionStorage.getItem(SCROLL_KEY)
      if (saved) {
        sessionStorage.removeItem(SCROLL_KEY)
        raf = window.requestAnimationFrame(() => {
          window.scrollTo(0, Number(saved) || 0)
        })
      }
    } catch { /* noop */ }
    return () => window.cancelAnimationFrame(raf)
  }, [])

  const fetchArticulos = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ activo: 'false' })
    if (q) params.set('q', q)
    if (filtroProveedor) params.set('proveedor_id', filtroProveedor)
    if (filtroMarca)     params.set('marca_id', filtroMarca)
    if (filtroCategoria) params.set('categoria_id', filtroCategoria)
    const res = await fetch(`/api/dashboard/articulos?${params}`)
    const data: ArticuloRow[] = await res.json()

    // Derive unique listas from precios_vigentes (max 3)
    const listaMap = new Map<number, ListaCol>()
    for (const a of data) {
      for (const pv of (a.precios_vigentes ?? [])) {
        if (!listaMap.has(pv.lista_id)) {
          listaMap.set(pv.lista_id, { id: pv.lista_id, nombre: pv.lista_nombre, tipo: pv.tipo, categoria: pv.categoria })
        }
      }
    }
    setListas(Array.from(listaMap.values()).slice(0, 3))
    setArticulos(data)
    setLoading(false)
  }, [q, filtroProveedor, filtroMarca, filtroCategoria])

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

  function clickEliminar(a: ArticuloRow) {
    setDeleteNombre(a.nombre)
    setDeleteId(a.id)
  }

  async function handleEliminar() {
    if (!deleteId) return
    setEliminando(true)
    const res = await fetch(`/api/dashboard/articulos/${deleteId}/permanent`, { method: 'DELETE' })
    setEliminando(false)
    if (res.ok) {
      toast.success(`Artículo "${deleteNombre}" eliminado`)
      setArticulos(prev => prev.filter(a => a.id !== deleteId))
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error al eliminar')
    }
    setDeleteId(null)
  }

  const colCount = 8
  const costoLista = listas.find(l => l.categoria === 'costo') ?? null
  const mainLista = listas.find(l => l.categoria === 'venta') ?? listas[0] ?? null

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, código o barras…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {can('inventario.articulos.crear') && (
            <Link href="/dashboard/inventario/articulos/nuevo" className={buttonVariants()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo artículo
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]"
          >
            <option value="">Todas las categorías</option>
            {categoriasList.map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
          </select>
          <select
            value={filtroMarca}
            onChange={e => setFiltroMarca(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]"
          >
            <option value="">Todas las marcas</option>
            {marcasList.map(m => <option key={m.id} value={String(m.id)}>{m.nombre}</option>)}
          </select>
          <select
            value={filtroProveedor}
            onChange={e => setFiltroProveedor(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]"
          >
            <option value="">Todos los proveedores</option>
            {proveedoresList.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
          </select>
          {(filtroCategoria || filtroMarca || filtroProveedor) && (
            <button
              onClick={() => { setFiltroCategoria(''); setFiltroMarca(''); setFiltroProveedor('') }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre / Variante</TableHead>
              <TableHead className="w-28">Código / SKU</TableHead>
              <TableHead className="w-28">Categoría</TableHead>
              <TableHead className="w-28">Marca</TableHead>
              <TableHead className="w-36">Proveedor</TableHead>
              <TableHead className="text-right w-32">
                {costoLista ? costoLista.nombre : 'Costo'}
              </TableHead>
              <TableHead className="text-right w-32">
                {mainLista ? mainLista.nombre : 'Precio'}
              </TableHead>
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
              articulos.flatMap((a) => {
                const mainRow = (
                  <TableRow key={`art-${a.id}`} className={!a.activo ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{a.nombre}</TableCell>
                    <TableCell className="text-gray-500 font-mono text-xs">{a.codigo ?? '—'}</TableCell>
                    <TableCell className="text-gray-500 text-sm truncate max-w-[112px]">
                      <div>{a.categorias?.nombre ?? '—'}</div>
                      {a.tipo_articulo === 'con_variantes' && (
                        <span className="flex items-center gap-1 text-purple-600 text-xs font-medium mt-0.5">
                          <Layers className="w-3 h-3" /> Con variantes
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm truncate max-w-[112px]">
                      {a.marcas?.nombre ?? '—'}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm truncate max-w-[144px]">
                      {a.proveedores?.nombre ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {a.tipo_articulo === 'con_variantes'
                        ? <span className="text-gray-300">—</span>
                        : formatPrecio(costoLista
                            ? (a.precios_vigentes?.find(p => p.lista_id === costoLista.id)?.precio ?? null)
                            : null)
                      }
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {a.tipo_articulo === 'con_variantes'
                        ? <span className="text-gray-300">—</span>
                        : formatPrecio(mainLista
                            ? (a.precios_vigentes?.find(p => p.lista_id === mainLista.id)?.precio ?? null)
                            : null)
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Link
                          href={`/dashboard/inventario/articulos/${a.id}`}
                          title="Ver / Editar"
                          onClick={guardarScroll}
                          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {can('inventario.articulos.editar') && (
                          <Link
                            href={`/dashboard/inventario/articulos/${a.id}`}
                            title="Editar"
                            onClick={guardarScroll}
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
                        {a.activo && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                            title="Eliminar permanentemente"
                            onClick={() => clickEliminar(a)}
                          >
                            <Trash2 className="w-4 h-4" />
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
                      <TableCell className="py-2" />
                      <TableCell className="py-2" />
                      <TableCell className="py-2 text-right tabular-nums text-sm">
                        {(() => {
                          const pv = costoLista ? v.precios_vigentes?.find(p => p.lista_id === costoLista.id) : null
                          return formatPrecio(pv?.precio ?? null)
                        })()}
                      </TableCell>
                      <TableCell className="py-2 text-right tabular-nums text-sm">
                        {(() => {
                          const pv = mainLista ? v.precios_vigentes?.find(p => p.lista_id === mainLista.id) : null
                          return <span className={pv?.heredado ? 'text-gray-400' : 'font-medium'}>{formatPrecio(pv?.precio ?? null)}</span>
                        })()}
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

      <ConfirmDialog
        open={deleteId !== null}
        title="Eliminar artículo"
        description={`¿Eliminar permanentemente "${deleteNombre}"? Esta acción no se puede deshacer. Solo funciona si el artículo no tiene remitos, ventas u órdenes asociadas.`}
        confirmLabel="Eliminar"
        loading={eliminando}
        onConfirm={handleEliminar}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
