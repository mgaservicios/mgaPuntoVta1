'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import ClienteSearch from '@/components/dashboard/ClienteSearch'
import type { Cliente } from '@/types/clientes'
import type { CtaCteCliente } from '@/app/api/dashboard/listados/cobranzas/route'

const METODO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia',
  TARJETA_DEBITO: 'Tarjeta débito', TARJETA_CREDITO: 'Tarjeta crédito',
  CHEQUE: 'Cheque', OTRO: 'Otro',
}

function ars(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}
function fDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

interface ReciboRow {
  id: number
  fecha: string
  monto: number
  metodo: string | null
  descripcion: string | null
  created_at: string
  cliente_id: number
  clientes: { nombre: string } | null
}

export default function RecibosPage() {
  const [recibos, setRecibos]   = useState<ReciboRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Filtros lista
  const [q, setQ]               = useState('')
  const [desde, setDesde]       = useState('')
  const [hasta, setHasta]       = useState('')

  // Form nuevo recibo
  const [cliente, setCliente]     = useState<Cliente | null>(null)
  const [saldoCliente, setSaldoCliente] = useState<number | null>(null)
  const [loadingSaldo, setLoadingSaldo] = useState(false)
  const [monto, setMonto]         = useState('')
  const [metodo, setMetodo]       = useState('EFECTIVO')
  const [descripcion, setDescripcion] = useState('Cobro en cuenta corriente')
  const [fecha, setFecha]         = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving]       = useState(false)

  const loadRecibos = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/dashboard/cobranzas?tipo=PAGO')
    if (res.ok) setRecibos(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadRecibos() }, [loadRecibos])

  // Cargar saldo cuando se selecciona un cliente
  useEffect(() => {
    if (!cliente) { setSaldoCliente(null); setMonto(''); return }
    setLoadingSaldo(true)
    fetch(`/api/dashboard/listados/cobranzas?cliente_id=${cliente.id}`)
      .then(r => r.json())
      .then((data: CtaCteCliente[]) => {
        const saldo = data[0]?.saldo_actual ?? 0
        setSaldoCliente(saldo)
        setMonto(saldo > 0 ? saldo.toFixed(2) : '')
      })
      .catch(() => setSaldoCliente(null))
      .finally(() => setLoadingSaldo(false))
  }, [cliente])

  function openForm() {
    setCliente(null)
    setSaldoCliente(null)
    setMonto('')
    setMetodo('EFECTIVO')
    setDescripcion('Cobro en cuenta corriente')
    setFecha(new Date().toISOString().slice(0, 10))
    setShowForm(true)
  }

  async function handleGuardar() {
    if (!cliente) { toast.error('Seleccioná un cliente'); return }
    const montoNum = parseFloat(monto)
    if (isNaN(montoNum) || montoNum <= 0) { toast.error('Monto inválido'); return }
    setSaving(true)
    const res = await fetch('/api/dashboard/cobranzas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: cliente.id, monto: montoNum, descripcion, fecha, metodo }),
    })
    if (res.ok) {
      const cobro = await res.json()
      toast.success('Recibo generado')
      setShowForm(false)
      loadRecibos()
      window.open(`/dashboard/fondos/cobranzas/recibos/${cobro.id}/print`, '_blank')
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al guardar')
    }
    setSaving(false)
  }

  const filtered = recibos.filter(r => {
    if (q && !r.clientes?.nombre.toLowerCase().includes(q.toLowerCase())) return false
    if (desde && r.fecha < desde) return false
    if (hasta && r.fecha > hasta) return false
    return true
  })

  const montoNum = parseFloat(monto) || 0
  const saldoPost = saldoCliente !== null ? saldoCliente - montoNum : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Recibos</h2>
          <p className="text-sm text-gray-400">Historial de cobros de cuenta corriente</p>
        </div>
        <Button onClick={openForm}>
          <Plus className="w-4 h-4 mr-1.5" />
          Nuevo recibo
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Buscar cliente</label>
          <Input placeholder="Nombre…" value={q} onChange={e => setQ(e.target.value)} className="w-52" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <Input type="date" className="w-40" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <Input type="date" className="w-40" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Recibo</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Observaciones</TableHead>
              <TableHead className="text-right w-32">Importe</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-gray-400">Sin recibos</TableCell>
              </TableRow>
            ) : filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <span className="font-mono text-sm text-gray-600">REC-{String(r.id).padStart(6, '0')}</span>
                </TableCell>
                <TableCell className="text-sm text-gray-600">{fDate(r.fecha)}</TableCell>
                <TableCell className="font-medium">{r.clientes?.nombre ?? `#${r.cliente_id}`}</TableCell>
                <TableCell>
                  {r.metodo
                    ? <Badge variant="outline" className="text-xs">{METODO_LABELS[r.metodo] ?? r.metodo}</Badge>
                    : <span className="text-gray-400">—</span>}
                </TableCell>
                <TableCell className="text-sm text-gray-500 truncate max-w-[200px]">
                  {r.descripcion ?? '—'}
                </TableCell>
                <TableCell className="text-right font-semibold text-green-700">{ars(r.monto)}</TableCell>
                <TableCell>
                  <button
                    title="Ver recibo"
                    onClick={() => window.open(`/dashboard/fondos/cobranzas/recibos/${r.id}/print`, '_blank')}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Dialog nuevo recibo */}
      <Dialog open={showForm} onOpenChange={v => !v && setShowForm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo recibo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Cliente *</Label>
              <ClienteSearch value={cliente} onChange={setCliente} />
            </div>

            {/* Saldo pendiente */}
            {cliente && (
              <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                {loadingSaldo ? (
                  <p className="text-xs text-gray-400">Cargando saldo…</p>
                ) : saldoCliente !== null ? (
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500">Saldo pendiente</p>
                    <p className={`text-sm font-semibold ${saldoCliente > 0.001 ? 'text-red-600' : saldoCliente < -0.001 ? 'text-green-600' : 'text-gray-400'}`}>
                      {saldoCliente > 0.001 ? ars(saldoCliente) : saldoCliente < -0.001 ? `A favor ${ars(Math.abs(saldoCliente))}` : 'Sin deuda'}
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            <div className="space-y-1">
              <Label>Importe ($) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                autoFocus={!!cliente}
              />
            </div>

            {/* Saldo resultante */}
            {saldoPost !== null && montoNum > 0 && (
              <div className={`text-xs px-3 py-2 rounded-md ${saldoPost < -0.001 ? 'bg-green-50 text-green-700' : saldoPost > 0.001 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                {saldoPost < -0.001
                  ? `Saldo a favor: ${ars(Math.abs(saldoPost))}`
                  : saldoPost > 0.001
                  ? `Saldo pendiente restante: ${ars(saldoPost)}`
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
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={saving || !cliente}>
              {saving ? 'Guardando…' : 'Guardar e imprimir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
