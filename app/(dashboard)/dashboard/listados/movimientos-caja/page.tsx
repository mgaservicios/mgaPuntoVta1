'use client'

import { useEffect, useState, useCallback } from 'react'
import { Printer, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { usePermissions } from '@/components/PermissionsProvider'
import type { MovRow, MovimientosResponse } from '@/app/api/dashboard/listados/movimientos-caja/route'

type Sucursal = { id: number; nombre: string }

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
  })
}

const FUENTE_LABELS: Record<string, string> = {
  caja: 'Caja',
  venta: 'Venta POS',
  ov: 'Orden de venta',
  ot: 'Óptica OT',
  sv: 'Óptica SV',
}

export default function MovimientosCajaPage() {
  const { isAdmin } = usePermissions()
  const [rows, setRows] = useState<MovRow[]>([])
  const [loading, setLoading] = useState(false)
  const [desde, setDesde] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10))
  const [sucursalId, setSucursalId] = useState<string>('actual')
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [totales, setTotales] = useState({ total_ingresos: 0, total_egresos: 0, saldo: 0 })

  useEffect(() => {
    fetch('/api/dashboard/sucursales')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSucursales(data) })
      .catch(() => {})
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    if (sucursalId && sucursalId !== 'actual') params.set('sucursal_id', sucursalId)
    try {
      const res = await fetch(`/api/dashboard/listados/movimientos-caja?${params}`)
      const data: MovimientosResponse = await res.json()
      setRows(data.movimientos ?? [])
      setTotales({
        total_ingresos: data.total_ingresos ?? 0,
        total_egresos: data.total_egresos ?? 0,
        saldo: data.saldo ?? 0,
      })
    } catch {
      setRows([])
      setTotales({ total_ingresos: 0, total_egresos: 0, saldo: 0 })
    }
    setLoading(false)
  }, [desde, hasta, sucursalId])

  useEffect(() => { fetchRows() }, [fetchRows]) // eslint-disable-line react-hooks/set-state-in-effect

  function handlePrint() {
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    if (sucursalId && sucursalId !== 'actual') params.set('sucursal_id', sucursalId)
    window.open(`/dashboard/listados/movimientos-caja/print?${params}`, '_blank')
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Movimientos de Caja</h2>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <Input type="date" className="w-40" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <Input type="date" className="w-40" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        {isAdmin && sucursales.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sucursal</label>
            <div className="w-52">
              <Select value={sucursalId} onValueChange={v => { if (v) setSucursalId(v) }}>
                <SelectTrigger>
                  <SelectValue>
                    {sucursalId === 'actual' ? 'Sucursal actual' : sucursales.find(s => String(s.id) === sucursalId)?.nombre ?? sucursalId}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="actual">Sucursal actual</SelectItem>
                  {sucursales.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors font-medium"
        >
          <Printer className="w-4 h-4" />
          Imprimir
        </button>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <p className="text-xs text-green-600 font-medium">Ingresos</p>
          <p className="text-lg font-bold text-green-700">{formatARS(totales.total_ingresos)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          <p className="text-xs text-red-600 font-medium">Egresos</p>
          <p className="text-lg font-bold text-red-700">{formatARS(totales.total_egresos)}</p>
        </div>
        <div className={`border rounded-lg px-4 py-2 ${totales.saldo >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-xs font-medium ${totales.saldo >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>Saldo</p>
          <p className={`text-lg font-bold ${totales.saldo >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>{formatARS(totales.saldo)}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-36">Fecha</TableHead>
              <TableHead className="w-20">Tipo</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="w-28">Fuente</TableHead>
              <TableHead className="w-32">Método</TableHead>
              <TableHead className="text-right w-28">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">Sin movimientos en el período</TableCell>
              </TableRow>
            ) : (
              rows.map(row => {
                const isExpanded = expandedId === row.id
                return (
                  <TableRow
                    key={`${row.fuente}-${row.id}`}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                  >
                    <TableCell className="w-8 px-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <span>{formatFecha(row.created_at)}</span>
                      <span className="text-gray-400 ml-1.5">{formatHora(row.created_at)}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.tipo === 'ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {row.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{row.concepto}</TableCell>
                    <TableCell className="text-sm text-gray-500">{FUENTE_LABELS[row.fuente] ?? row.fuente}</TableCell>
                    <TableCell className="text-sm text-gray-500">{row.metodo || '—'}</TableCell>
                    <TableCell className={`text-right font-medium text-sm ${row.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                      {row.tipo === 'ingreso' ? '+' : '−'}{formatARS(row.monto)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Expanded details */}
        {!loading && rows.length > 0 && expandedId !== null && (() => {
          const row = rows.find(r => r.id === expandedId)
          if (!row) return null
          return (
            <div className="border-t bg-gray-50 px-4 py-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-400 text-xs">Fuente</span>
                  <p className="font-medium">{FUENTE_LABELS[row.fuente] ?? row.fuente}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Sesión ID</span>
                  <p className="font-medium">{row.sesion_id ?? '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Referencia</span>
                  <p className="font-medium">{row.referencia ?? '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Sucursal</span>
                  <p className="font-medium">{row.sucursal_nombre ?? '—'}</p>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
        <span>{rows.length} movimiento{rows.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}
