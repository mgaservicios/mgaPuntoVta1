'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Printer } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { ListaPrecio } from '@/types/precios'
import type { Categoria, Subcategoria, Marca } from '@/types/articulos'
import type { PrecioRow } from '@/app/api/dashboard/listados/precios/route'

function formatARS(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

export default function ListadoPreciosPage() {
  const [listas, setListas] = useState<ListaPrecio[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])

  const [listaId, setListaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('todos')
  const [subcategoriaId, setSubcategoriaId] = useState('todos')
  const [marcaId, setMarcaId] = useState('todos')
  const [rows, setRows] = useState<PrecioRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/listas-precio').then(r => r.json()),
      fetch('/api/dashboard/categorias').then(r => r.json()),
      fetch('/api/dashboard/marcas').then(r => r.json()),
    ]).then(([listasData, catsData, marcasData]) => {
      const listasVenta = (Array.isArray(listasData) ? listasData : []).filter(
        (l: ListaPrecio) => l.categoria === 'venta' && l.activo
      )
      setListas(listasVenta)
      if (listasVenta.length > 0) setListaId(String(listasVenta[0].id))
      setCategorias(Array.isArray(catsData) ? catsData : [])
      setMarcas(Array.isArray(marcasData) ? marcasData : [])
    })
  }, [])

  const subcategoriasFiltradas: Subcategoria[] = categorias
    .find(c => String(c.id) === categoriaId)
    ?.subcategorias ?? []

  const fetchPrecios = useCallback(async () => {
    if (!listaId) return
    setLoading(true)
    const params = new URLSearchParams({ lista_id: listaId })
    if (categoriaId && categoriaId !== 'todos') params.set('categoria_id', categoriaId)
    if (subcategoriaId && subcategoriaId !== 'todos') params.set('subcategoria_id', subcategoriaId)
    if (marcaId && marcaId !== 'todos') params.set('marca_id', marcaId)
    const res = await fetch(`/api/dashboard/listados/precios?${params}`)
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [listaId, categoriaId, subcategoriaId, marcaId])

  useEffect(() => { fetchPrecios() }, [fetchPrecios]) // eslint-disable-line react-hooks/set-state-in-effect

  const hasVariantes = useMemo(() => rows.some(r => r.variante_desc != null), [rows])

  const colCount = hasVariantes ? 4 : 3

  function handlePrint() {
    const params = new URLSearchParams()
    if (listaId) params.set('lista_id', listaId)
    if (categoriaId && categoriaId !== 'todos') params.set('categoria_id', categoriaId)
    if (subcategoriaId && subcategoriaId !== 'todos') params.set('subcategoria_id', subcategoriaId)
    if (marcaId && marcaId !== 'todos') params.set('marca_id', marcaId)
    window.open(`/dashboard/listados/precios/print?${params}`, '_blank')
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Listado de precios</h2>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Lista</label>
          <Select value={listaId} onValueChange={(v) => { if (v) setListaId(v) }}>
            <SelectTrigger>
              <SelectValue>
                {listas.find(l => String(l.id) === listaId)?.nombre}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {listas.map(l => (
                <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Rubro</label>
          <Select value={categoriaId} onValueChange={(v) => { if (v) { setCategoriaId(v); setSubcategoriaId('todos') } }}>
            <SelectTrigger>
              <SelectValue>
                {categorias.find(c => String(c.id) === categoriaId)?.nombre ?? 'Todos los rubros'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los rubros</SelectItem>
              {categorias.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Subrubro</label>
          <Select
            value={subcategoriaId}
            onValueChange={(v) => { if (v) setSubcategoriaId(v) }}
            disabled={!categoriaId || categoriaId === 'todos'}
          >
            <SelectTrigger>
              <SelectValue>
                {subcategoriasFiltradas.find(s => String(s.id) === subcategoriaId)?.nombre ?? 'Todos los subrubros'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los subrubros</SelectItem>
              {subcategoriasFiltradas.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Marca</label>
          <Select value={marcaId} onValueChange={(v) => { if (v) setMarcaId(v) }}>
            <SelectTrigger>
              <SelectValue>
                {marcas.find(m => String(m.id) === marcaId)?.nombre ?? 'Todas las marcas'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las marcas</SelectItem>
              {marcas.map(m => (
                <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors font-medium"
        >
          <Printer className="w-4 h-4" />
          Imprimir
        </button>
      </div>

      {rows.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
          <span className="text-sm text-blue-700">{rows.length} artículos</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Código</TableHead>
              <TableHead>Artículo</TableHead>
              {hasVariantes && <TableHead>Variante</TableHead>}
              <TableHead className="text-right w-32">Precio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center py-8 text-gray-400">Sin resultados</TableCell>
              </TableRow>
            ) : rows.map((row, i) => (
              <TableRow key={`${row.articulo_id}-${row.variante_id ?? 0}-${i}`}>
                <TableCell className="font-mono text-xs text-gray-500">{row.codigo ?? '—'}</TableCell>
                <TableCell className="text-sm">{row.articulo}</TableCell>
                {hasVariantes && (
                  <TableCell className="text-sm text-gray-500">{row.variante_desc ?? '—'}</TableCell>
                )}
                <TableCell className="text-right font-medium">{formatARS(row.precio)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
