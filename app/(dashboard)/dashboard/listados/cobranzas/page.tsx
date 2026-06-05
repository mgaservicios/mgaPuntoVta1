'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import ClienteSearch from '@/components/dashboard/ClienteSearch'
import type { Cliente } from '@/types/clientes'
import type { CobranzaRow } from '@/app/api/dashboard/listados/cobranzas/route'

type DayGroup = { fecha: string; rows: CobranzaRow[]; subtotal: number }

const METODO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA_DEBITO: 'Tarjeta débito',
  TARJETA_CREDITO: 'Tarjeta crédito',
  CUENTA_CORRIENTE: 'Cuenta corriente',
  NOTA_CREDITO: 'Nota de crédito',
  OTRO: 'Otro',
}

const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CUENTA_CORRIENTE', 'NOTA_CREDITO', 'OTRO']

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function groupByDay(rows: CobranzaRow[]): DayGroup[] {
  const map = new Map<string, CobranzaRow[]>()
  for (const row of rows) {
    const existing = map.get(row.fecha) ?? []
    existing.push(row)
    map.set(row.fecha, existing)
  }
  return Array.from(map.entries()).map(([fecha, gRows]) => ({
    fecha,
    rows: gRows,
    subtotal: gRows.reduce((acc, r) => acc + r.importe, 0),
  }))
}

export default function ListadoCobranzasPage() {
  const [rows, setRows] = useState<CobranzaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [desde, setDesde] = useState(() => new Date().toISOString().slice(0, 10))
  const [hasta, setHasta] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [formaPago, setFormaPago] = useState('todos')

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    if (clienteSeleccionado) params.set('cliente_id', String(clienteSeleccionado.id))
    if (formaPago !== 'todos') params.set('forma_pago', formaPago)
    const res = await fetch(`/api/dashboard/listados/cobranzas?${params}`)
    if (!res.ok) { setRows([]); setLoading(false); return }
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [desde, hasta, clienteSeleccionado, formaPago])

  useEffect(() => { fetchRows() }, [fetchRows]) // eslint-disable-line react-hooks/set-state-in-effect

  const groups = groupByDay(rows)
  const totalGeneral = groups.reduce((acc, g) => acc + g.subtotal, 0)

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Listado de cobranzas</h2>

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
          <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
          <div className="w-60">
            <ClienteSearch value={clienteSeleccionado} onChange={setClienteSeleccionado} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Forma de pago</label>
          <Select value={formaPago} onValueChange={(v) => { if (v) setFormaPago(v) }}>
            <SelectTrigger>
              <SelectValue>
                {formaPago === 'todos' ? 'Todos' : METODO_LABELS[formaPago] ?? formaPago}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {METODOS.map(m => (
                <SelectItem key={m} value={m}>{METODO_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Forma de pago</TableHead>
              <TableHead>Comprobante</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right w-32">Importe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-400">Sin cobranzas en el período</TableCell>
              </TableRow>
            ) : groups.map(group => (
              <Fragment key={group.fecha}>
                <TableRow className="bg-gray-50 border-t-2 border-gray-200">
                  <TableCell colSpan={2} className="font-semibold text-sm">
                    {formatFecha(group.fecha)}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">
                    {group.rows.length} cobros
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${group.subtotal < 0 ? 'text-red-600' : ''}`}>
                    {formatARS(group.subtotal)}
                  </TableCell>
                </TableRow>
                {group.rows
                  .slice()
                  .sort((a, b) => a.forma_pago.localeCompare(b.forma_pago))
                  .map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{METODO_LABELS[row.forma_pago] ?? row.forma_pago}</TableCell>
                    <TableCell className="font-mono text-sm">{row.ticket}</TableCell>
                    <TableCell>{row.cliente ?? <span className="text-gray-400">Consumidor final</span>}</TableCell>
                    <TableCell className={`text-right ${row.importe < 0 ? 'text-red-600' : ''}`}>{formatARS(row.importe)}</TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
            {groups.length > 0 && (
              <TableRow className="bg-gray-100 font-semibold">
                <TableCell colSpan={3} className="text-sm">Total general</TableCell>
                <TableCell className={`text-right ${totalGeneral < 0 ? 'text-red-600' : ''}`}>{formatARS(totalGeneral)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
