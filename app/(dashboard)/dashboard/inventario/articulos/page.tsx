'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Eye, Pencil, PowerOff, Layers, Upload } from 'lucide-react'
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
  const [q, setQ] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroMarca, setFiltroMarca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [proveedoresList, setProveedoresList] = useState<FiltroItem[]>([])
  const [marcasList, setMarcasList] = useState<FiltroItem[]>([])
  const [categoriasList, setCategoriasList] = useState<FiltroItem[]>([])
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [desactivando, setDesactivando] = useState(false)

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

  const colCount = 7
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
            <div className="flex gap-2">
              <Link href="/dashboard/inventario/importar-articulos" className={buttonVariants({ variant: 'outline' })}>
                <Upload className="w-4 h-4 mr-2" />
                Importar
              </Link>
              <Link href="/dashboard/inventario/articulos/nuevo" className={buttonVariants()}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo artículo
              </Link>
            </div>
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
                      <TableCell className="py-2" />
                      <TableCell className="py-2" />
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
    </div>
  )
}
