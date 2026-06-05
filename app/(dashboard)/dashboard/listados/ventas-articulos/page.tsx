'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { VentaArticuloRow } from '@/app/api/dashboard/listados/ventas-articulos/route'

type DayGroup = { fecha: string; rows: VentaArticuloRow[] }

function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function groupByDay(rows: VentaArticuloRow[]): DayGroup[] {
  const map = new Map<string, VentaArticuloRow[]>()
  for (const row of rows) {
    const existing = map.get(row.fecha) ?? []
    existing.push(row)
    map.set(row.fecha, existing)
  }
  return Array.from(map.entries()).map(([fecha, gRows]) => ({ fecha, rows: gRows }))
}

export default function ListadoVentasArticulosPage() {
  const [rows, setRows] = useState<VentaArticuloRow[]>([])
  const [loading, setLoading] = useState(false)
  const [desde, setDesde] = useState(() => new Date().toISOString().slice(0, 10))
  const [hasta, setHasta] = useState('')
  const [tipo, setTipo] = useState('todos')

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    if (tipo !== 'todos') params.set('tipo', tipo)
    const res = await fetch(`/api/dashboard/listados/ventas-articulos?${params}`)
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [desde, hasta, tipo])

  useEffect(() => { fetchRows() }, [fetchRows]) // eslint-disable-line react-hooks/set-state-in-effect

  const groups = groupByDay(rows)

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Listado de venta de artículos</h2>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <Input
            type="date"
            className="w-40"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <Input
            type="date"
            className="w-40"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
          <div className="w-44">
            <Select value={tipo} onValueChange={(v) => { if (v) setTipo(v) }}>
              <SelectTrigger>
                <SelectValue>
                  {tipo === 'todos' ? 'Todos' : tipo === 'venta' ? 'Venta' : 'Receta'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="venta">Venta</SelectItem>
                <SelectItem value="receta">Receta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Artículo</TableHead>
              <TableHead className="w-28">Comprobante</TableHead>
              <TableHead className="text-right w-20">Cant.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-gray-400">Sin ventas en el período</TableCell>
              </TableRow>
            ) : groups.map(group => (
              <Fragment key={group.fecha}>
                <TableRow className="bg-gray-50 border-t-2 border-gray-200">
                  <TableCell colSpan={3} className="font-semibold text-sm">
                    {formatFecha(group.fecha)}
                  </TableCell>
                </TableRow>
                {group.rows
                  .slice()
                  .sort((a, b) => a.articulo.localeCompare(b.articulo))
                  .map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{row.articulo}</TableCell>
                    <TableCell className="font-mono text-sm">{row.comprobante}</TableCell>
                    <TableCell className="text-right">{row.cantidad}</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
