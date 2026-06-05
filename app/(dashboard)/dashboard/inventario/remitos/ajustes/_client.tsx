'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Discrepancia {
  articulo_id: number
  variante_id: number | null
  sucursal_id: number
  nombre_articulo: string
  descripcion_variante: string | null
  nombre_sucursal: string
  stock_actual: number
  stock_calculado: number
  diferencia: number
}

interface Row extends Discrepancia {
  selected: boolean
  stock_nuevo: string
}

interface Sucursal {
  id: number
  nombre: string
}

interface Props {
  activeSucursalId: number
  sucursales: Sucursal[]
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 }).format(n)
}

function rowKey(r: { articulo_id: number; variante_id: number | null; sucursal_id: number }) {
  return `${r.articulo_id}|${r.variante_id ?? ''}|${r.sucursal_id}`
}

export default function AjustesStockClient({ activeSucursalId, sucursales }: Props) {
  const [sucursalId, setSucursalId] = useState(String(activeSucursalId))
  const [rows, setRows] = useState<Row[]>([])
  const [calculando, setCalculando] = useState(false)
  const [ajustando, setAjustando] = useState(false)
  const [calculado, setCalculado] = useState(false)

  async function handleCalcular() {
    setCalculando(true)
    setCalculado(false)
    setRows([])
    const url = sucursalId
      ? `/api/dashboard/stock/ajustes?sucursal_id=${sucursalId}`
      : '/api/dashboard/stock/ajustes'
    const res = await fetch(url)
    setCalculando(false)

    if (!res.ok) { toast.error('Error al calcular discrepancias'); return }

    const data: Discrepancia[] = await res.json()
    setRows(data.map(d => ({ ...d, selected: true, stock_nuevo: String(d.stock_calculado) })))
    setCalculado(true)
    if (data.length === 0) toast.success('No se encontraron discrepancias de stock')
  }

  function toggleSelect(key: string) {
    setRows(prev => prev.map(r => rowKey(r) === key ? { ...r, selected: !r.selected } : r))
  }

  const allSelected  = rows.length > 0 && rows.every(r => r.selected)
  const someSelected = rows.some(r => r.selected)

  function toggleAll() {
    setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })))
  }

  function setStockNuevo(key: string, val: string) {
    setRows(prev => prev.map(r => rowKey(r) === key ? { ...r, stock_nuevo: val } : r))
  }

  const selectedRows = rows.filter(r => r.selected)

  async function handleAjustar() {
    if (selectedRows.length === 0) { toast.error('Seleccioná al menos un artículo'); return }

    const ajustes = selectedRows.map(r => ({
      articulo_id: r.articulo_id,
      variante_id: r.variante_id,
      sucursal_id: r.sucursal_id,
      stock_nuevo: parseFloat(r.stock_nuevo) || 0,
    }))

    setAjustando(true)
    const res = await fetch('/api/dashboard/stock/ajustes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ajustes }),
    })
    setAjustando(false)

    if (res.ok) {
      const data = await res.json()
      const remitosStr = data.remitos?.length
        ? ` — Remitos: ${data.remitos.join(', ')}`
        : ''
      toast.success(`${data.count} ${data.count === 1 ? 'artículo ajustado' : 'artículos ajustados'}${remitosStr}`)
      const adjustedKeys = new Set(selectedRows.map(rowKey))
      setRows(prev => prev.filter(r => !adjustedKeys.has(rowKey(r))))
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al ajustar stock')
    }
  }

  const activeSucursalNombre = sucursales.find(s => s.id === activeSucursalId)?.nombre

  return (
    <div className="space-y-5">

      {/* Controles */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Sucursal</label>
            <select
              className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white"
              value={sucursalId}
              onChange={(e) => { setSucursalId(e.target.value); setRows([]); setCalculado(false) }}
            >
              {sucursales.map(s => (
                <option key={s.id} value={String(s.id)}>
                  {s.nombre}{s.id === activeSucursalId ? ' (activa)' : ''}
                </option>
              ))}
            </select>
            {activeSucursalNombre && (
              <span className="text-xs text-indigo-600 font-medium">
                Activa: {activeSucursalNombre}
              </span>
            )}
          </div>

          <Button onClick={handleCalcular} disabled={calculando} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${calculando ? 'animate-spin' : ''}`} />
            {calculando ? 'Calculando…' : 'Calcular discrepancias'}
          </Button>

          {rows.length > 0 && (
            <Button
              disabled={!someSelected || ajustando}
              onClick={handleAjustar}
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              {ajustando
                ? 'Ajustando…'
                : `Ajustar seleccionados (${selectedRows.length})`}
            </Button>
          )}
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          Compara el stock registrado en el sistema contra el calculado desde remitos y ventas de la sucursal.
          Las discrepancias pueden surgir de carga manual inicial, errores o datos históricos.
        </p>
      </div>

      {/* Sin discrepancias */}
      {calculado && rows.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-600 font-medium">Sin discrepancias</p>
          <p className="text-sm text-gray-400 mt-1">
            El stock registrado coincide con el calculado desde los movimientos.
          </p>
        </div>
      )}

      {/* Tabla de discrepancias */}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {rows.length} {rows.length === 1 ? 'discrepancia encontrada' : 'discrepancias encontradas'}
            </p>
            <button
              onClick={toggleAll}
              className="text-xs text-blue-600 hover:underline"
            >
              {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50/60">
                <tr>
                  <th className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Artículo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Sucursal</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Stock actual</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Stock calculado</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Diferencia</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Nuevo stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(row => {
                  const k = rowKey(row)
                  return (
                    <tr key={k} className={row.selected ? 'bg-blue-50/40' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleSelect(k)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{row.nombre_articulo}</p>
                        {row.descripcion_variante && (
                          <p className="text-xs text-gray-400 mt-0.5">{row.descripcion_variante}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{row.nombre_sucursal}</td>
                      <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                        {fmt(row.stock_actual)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                        {fmt(row.stock_calculado)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <Badge
                          variant={row.diferencia > 0 ? 'default' : 'destructive'}
                          className="font-mono text-xs"
                        >
                          {row.diferencia > 0 ? '+' : ''}{fmt(row.diferencia)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          step="0.001"
                          className="w-28 text-right text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={row.stock_nuevo}
                          onChange={(e) => setStockNuevo(k, e.target.value)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
