'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { usePermissions } from '@/components/PermissionsProvider'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

function ars(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}
function fDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const METODO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA_DEBITO: 'Tarjeta débito',
  TARJETA_CREDITO: 'Tarjeta crédito',
  CHEQUE: 'Cheque',
  OTRO: 'Otro',
}

function docRef(m: Mov): string | null {
  if (m.optica_orden_id)    return `OT #${m.optica_orden_id}`
  if (m.optica_servicio_id) return `SV #${m.optica_servicio_id}`
  if (m.orden_id)           return `OV #${m.orden_id}`
  if (m.venta_id)           return `VTA #${m.venta_id}`
  return null
}

interface Mov {
  id: number
  tipo: 'CARGO' | 'PAGO'
  monto: number
  fecha: string
  descripcion: string | null
  metodo: string | null
  created_at: string
  venta_id: number | null
  orden_id: number | null
  optica_orden_id: number | null
  optica_servicio_id: number | null
}

interface ClienteRow {
  cliente_id: number
  nombre: string
  cargo: number
  pago: number
  saldo: number
  movimientos: Mov[]
}

interface CobranzaRaw {
  id: number
  tipo: 'CARGO' | 'PAGO'
  monto: number
  fecha: string
  descripcion: string | null
  metodo: string | null
  created_at: string
  cliente_id: number
  clientes: { nombre: string } | null
  venta_id: number | null
  orden_id: number | null
  optica_orden_id: number | null
  optica_servicio_id: number | null
}

function buildRows(raw: CobranzaRaw[]): ClienteRow[] {
  const map = new Map<number, ClienteRow>()
  for (const c of raw) {
    if (!c.cliente_id) continue
    if (!map.has(c.cliente_id)) {
      map.set(c.cliente_id, {
        cliente_id: c.cliente_id,
        nombre: c.clientes?.nombre ?? `Cliente #${c.cliente_id}`,
        cargo: 0, pago: 0, saldo: 0,
        movimientos: [],
      })
    }
    const row = map.get(c.cliente_id)!
    if (c.tipo === 'CARGO') row.cargo += Number(c.monto)
    else row.pago += Number(c.monto)
    row.movimientos.push(c)
  }
  for (const row of map.values()) row.saldo = row.cargo - row.pago
  return [...map.values()].sort((a, b) => b.saldo - a.saldo)
}

export default function CobranzasPage() {
  const { can } = usePermissions()
  const [rows, setRows] = useState<ClienteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [soloConSaldo, setSoloConSaldo] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [cobrandoId, setCobrandoId] = useState<number | null>(null)
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [metodo, setMetodo] = useState('EFECTIVO')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/dashboard/cobranzas')
    if (res.ok) {
      const data: CobranzaRaw[] = await res.json()
      setRows(buildRows(data))
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => {
    if (soloConSaldo && r.saldo <= 0.001) return false
    if (q && !r.nombre.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  const totalSaldo = rows.reduce((s, r) => s + r.saldo, 0)

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function openCobro(id: number) {
    const row = rows.find(r => r.cliente_id === id)
    setCobrandoId(id)
    setMonto(row ? row.saldo.toFixed(2) : '')
    setDescripcion('Cobro en cuenta corriente')
    setFecha(new Date().toISOString().slice(0, 10))
    setMetodo('EFECTIVO')
  }

  async function handleCobrar() {
    if (!cobrandoId) return
    const montoNum = parseFloat(monto)
    if (isNaN(montoNum) || montoNum <= 0) { toast.error('Monto inválido'); return }
    setSaving(true)
    const res = await fetch('/api/dashboard/cobranzas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: cobrandoId, monto: montoNum, descripcion, fecha, metodo }),
    })
    if (res.ok) {
      const cobro = await res.json()
      toast.success('Cobro registrado')
      setCobrandoId(null)
      load()
      window.open(`/dashboard/cobranzas/recibos/${cobro.id}/print`, '_blank')
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al registrar cobro')
    }
    setSaving(false)
  }

  const cobrando = rows.find(r => r.cliente_id === cobrandoId)
  const montoNum = parseFloat(monto) || 0
  const saldoResultante = (cobrando?.saldo ?? 0) - montoNum

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 w-fit">
        <div className="p-2 bg-blue-50 rounded-lg">
          <DollarSign className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <p className="text-xs text-gray-500">Total saldo a cobrar</p>
          <p className="text-2xl font-bold text-gray-900">{ars(totalSaldo)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar cliente…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-60"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={soloConSaldo}
            onChange={e => setSoloConSaldo(e.target.checked)}
            className="rounded"
          />
          Solo con saldo pendiente
        </label>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Debe</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400 py-10">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400 py-10">
                  Sin resultados
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(row => (
                <React.Fragment key={row.cliente_id}>
                  <TableRow className="cursor-pointer hover:bg-gray-50">
                    <TableCell>
                      <button
                        onClick={() => toggleExpand(row.cliente_id)}
                        className="text-gray-400 hover:text-gray-700"
                      >
                        {expanded.has(row.cliente_id)
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{row.nombre}</TableCell>
                    <TableCell className="text-right text-gray-600">{ars(row.cargo)}</TableCell>
                    <TableCell className="text-right text-gray-600">{ars(row.pago)}</TableCell>
                    <TableCell className="text-right">
                      <Badge className={row.saldo > 0.001 ? 'bg-red-100 text-red-700 border-0' : 'bg-green-100 text-green-700 border-0'}>
                        {ars(row.saldo)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.saldo > 0.001 && can('caja.cobranzas.ver') && (
                        <Button size="sm" variant="outline" onClick={() => openCobro(row.cliente_id)}>
                          Cobrar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>

                  {expanded.has(row.cliente_id) && (
                    <TableRow>
                      <TableCell />
                      <TableCell colSpan={5} className="p-0">
                        <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                                <th className="text-left pb-2">Fecha</th>
                                <th className="text-left pb-2">Descripción</th>
                                <th className="text-left pb-2">Documento</th>
                                <th className="text-right pb-2">Tipo</th>
                                <th className="text-right pb-2">Monto</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {row.movimientos.map(m => (
                                <tr key={m.id}>
                                  <td className="py-1.5 text-gray-500">{fDate(m.fecha)}</td>
                                  <td className="py-1.5 text-gray-700">
                                    {m.descripcion ?? '—'}
                                    {m.tipo === 'PAGO' && m.metodo && (
                                      <span className="ml-1 text-xs text-gray-400">
                                        · {METODO_LABELS[m.metodo] ?? m.metodo}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1.5">
                                    {docRef(m) ? (
                                      <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                        {docRef(m)}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 text-right">
                                    <span className={m.tipo === 'CARGO'
                                      ? 'text-red-600 font-medium'
                                      : 'text-green-600 font-medium'}>
                                      {m.tipo === 'CARGO' ? 'Cargo' : 'Pago'}
                                    </span>
                                  </td>
                                  <td className="py-1.5 text-right font-mono">{ars(Number(m.monto))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog cobro */}
      <Dialog open={cobrandoId !== null} onOpenChange={v => !v && setCobrandoId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar cobro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Cliente + saldo */}
            <div className="bg-gray-50 rounded-lg px-3 py-2.5 space-y-0.5">
              <p className="text-sm font-semibold text-gray-800">{cobrando?.nombre}</p>
              <p className="text-xs text-gray-500">
                Saldo pendiente: <span className="font-medium text-gray-700">{ars(cobrando?.saldo ?? 0)}</span>
              </p>
            </div>

            <div className="space-y-1">
              <Label>Importe a cobrar ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                autoFocus
              />
            </div>

            {/* Saldo resultante */}
            {montoNum > 0 && (
              <div className={`text-xs px-3 py-2 rounded-md ${saldoResultante < -0.001 ? 'bg-green-50 text-green-700' : saldoResultante > 0.001 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                {saldoResultante < -0.001
                  ? `Saldo a favor del cliente: ${ars(Math.abs(saldoResultante))}`
                  : saldoResultante > 0.001
                  ? `Saldo pendiente restante: ${ars(saldoResultante)}`
                  : 'Cuenta corriente queda al día'}
              </div>
            )}

            <div className="space-y-1">
              <Label>Método de cobro</Label>
              <Select value={metodo} onValueChange={(v) => v !== null && setMetodo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                  <SelectItem value="TARJETA_DEBITO">Tarjeta débito</SelectItem>
                  <SelectItem value="TARJETA_CREDITO">Tarjeta crédito</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                  <SelectItem value="OTRO">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Observaciones</Label>
              <Input value={descripcion} onChange={e => setDescripcion(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCobrandoId(null)}>Cancelar</Button>
            <Button onClick={handleCobrar} disabled={saving}>
              {saving ? 'Guardando…' : 'Registrar y ver recibo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
