'use client'

import { useState, useCallback, Fragment } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

type VarianteAtrib = { valor: string; atributo_tipos: { nombre: string } | null }
type Entry = {
  id: number
  articulo_id: number
  variante_id: number | null
  lista_precio_id: number
  precio: number
  vigente_desde: string
  origen_tipo: string | null
  articulo:  { id: number; codigo: string | null; nombre: string } | null
  variante:  { id: number; sku: string | null; variante_atributos: VarianteAtrib[] } | null
  lista_precio: { id: number; nombre: string } | null
  proveedor: { nombre: string } | null
  remito:    { numero: string } | null
}

type Grupo = {
  articulo_id: number
  nombre: string
  codigo: string | null
  entradas: Entry[]
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

const fmtFecha = (s: string) =>
  s ? new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

function varianteLabel(v: Entry['variante']): string {
  if (!v) return '—'
  const attrs = v.variante_atributos ?? []
  if (attrs.length > 0)
    return attrs.map(a => `${a.atributo_tipos?.nombre ?? ''}: ${a.valor}`).join(' / ')
  return v.sku ?? `Variante ${v.id}`
}

function origenLabel(e: Entry): string {
  if (e.proveedor?.nombre) return e.proveedor.nombre
  if (e.remito?.numero)    return `Remito ${e.remito.numero}`
  if (e.origen_tipo === 'sucursal') return 'Sucursal'
  return 'Manual'
}

export default function PreciosCostoPage() {
  const hoy = new Date().toISOString().slice(0, 10)
  const hace30 = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)

  const [q, setQ]               = useState('')
  const [fechaDesde, setFechaDesde] = useState(hace30)
  const [fechaHasta, setFechaHasta] = useState(hoy)
  const [grupos, setGrupos]     = useState<Grupo[]>([])
  const [loading, setLoading]   = useState(false)
  const [buscado, setBuscado]   = useState(false)

  const fetchData = useCallback(async (
    query: string, desde: string, hasta: string
  ) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (desde) params.set('fecha_desde', desde)
    if (hasta) params.set('fecha_hasta', hasta)

    const res  = await fetch(`/api/dashboard/consultas/precios-costo?${params}`)
    const data: Entry[] = res.ok ? await res.json() : []

    // Agrupar por artículo
    const map = new Map<number, Grupo>()
    for (const e of data) {
      if (!e.articulo) continue
      if (!map.has(e.articulo_id)) {
        map.set(e.articulo_id, {
          articulo_id: e.articulo_id,
          nombre: e.articulo.nombre,
          codigo: e.articulo.codigo,
          entradas: [],
        })
      }
      map.get(e.articulo_id)!.entradas.push(e)
    }

    setGrupos(Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
    setLoading(false)
    setBuscado(true)
  }, [])

  function handleBuscar() {
    fetchData(q, fechaDesde, fechaHasta)
  }

  const totalEntradas = grupos.reduce((s, g) => s + g.entradas.length, 0)

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-5">Historial de precios de costo</h2>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-48">
            <p className="text-xs text-gray-500 mb-1.5">Artículo</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Nombre o código…"
                className="pl-9"
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleBuscar()}
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Desde</p>
            <Input
              type="date"
              className="w-36"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Hasta</p>
            <Input
              type="date"
              className="w-36"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
            />
          </div>
          <Button onClick={handleBuscar} disabled={loading}>
            {loading ? 'Buscando…' : 'Buscar'}
          </Button>
        </div>
      </div>

      {/* Resultados */}
      {!buscado ? (
        <p className="text-sm text-gray-400 text-center py-12">
          Aplicá los filtros y hacé clic en <strong>Buscar</strong> para ver el historial.
        </p>
      ) : loading ? (
        <p className="text-sm text-gray-400 text-center py-12">Cargando…</p>
      ) : grupos.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">Sin resultados para los filtros seleccionados.</p>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-3">
            {grupos.length} artículo{grupos.length !== 1 ? 's' : ''} · {totalEntradas} registro{totalEntradas !== 1 ? 's' : ''}
          </p>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Variante</TableHead>
                  <TableHead>Lista</TableHead>
                  <TableHead className="text-right w-32">Precio</TableHead>
                  <TableHead className="w-32">Vigente desde</TableHead>
                  <TableHead>Origen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupos.map(grupo => (
                  <Fragment key={grupo.articulo_id}>
                    {/* Fila de encabezado del artículo */}
                    <TableRow key={`h-${grupo.articulo_id}`} className="bg-gray-50 hover:bg-gray-50">
                      <TableCell colSpan={5} className="py-2 px-4">
                        <span className="font-semibold text-gray-800 text-sm">{grupo.nombre}</span>
                        {grupo.codigo && (
                          <span className="ml-2 text-xs text-gray-400 font-mono">{grupo.codigo}</span>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Entradas del historial */}
                    {grupo.entradas.map(e => (
                      <TableRow key={e.id} className="text-sm">
                        <TableCell className="text-gray-500 pl-6">
                          {e.variante_id ? varianteLabel(e.variante) : '—'}
                        </TableCell>
                        <TableCell className="text-gray-600">{e.lista_precio?.nombre ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-gray-900">
                          {fmt(e.precio)}
                        </TableCell>
                        <TableCell className="text-gray-500">{fmtFecha(e.vigente_desde)}</TableCell>
                        <TableCell className="text-gray-500">{origenLabel(e)}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
