'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import ClienteSearch from '@/components/dashboard/ClienteSearch'
import type { Cliente } from '@/types/clientes'
import type { CtaCteCliente, CtaCteMovimiento } from '@/app/api/dashboard/listados/cobranzas/route'

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

function MovRow({ m }: { m: CtaCteMovimiento }) {
  const esCargo = m.tipo === 'CARGO'
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50 text-sm">
      <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{fDate(m.fecha)}</td>
      <td className="py-2 px-3">
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${esCargo ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {esCargo ? 'Cargo' : 'Pago'}
        </span>
      </td>
      <td className="py-2 px-3 text-gray-700">
        {m.descripcion ?? '—'}
        {!esCargo && m.metodo && (
          <span className="ml-1.5 text-xs text-gray-400">· {METODO_LABELS[m.metodo] ?? m.metodo}</span>
        )}
      </td>
      <td className={`py-2 px-3 text-right font-mono font-medium ${esCargo ? 'text-red-600' : 'text-green-600'}`}>
        {esCargo ? '+' : '−'}{ars(m.importe)}
      </td>
      <td className={`py-2 px-3 text-right font-mono font-semibold ${m.saldo > 0.001 ? 'text-gray-800' : m.saldo < -0.001 ? 'text-green-600' : 'text-gray-400'}`}>
        {ars(m.saldo)}
      </td>
    </tr>
  )
}

function ClienteCard({ cliente }: { cliente: CtaCteCliente }) {
  const [open, setOpen] = useState(false)
  const aFavor = cliente.saldo_actual < -0.001
  const alDia  = Math.abs(cliente.saldo_actual) <= 0.001

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Cabecera del cliente */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{cliente.nombre}</p>
          <p className="text-xs text-gray-400">{cliente.movimientos.length} movimiento{cliente.movimientos.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="text-right shrink-0 mr-2">
          <p className="text-xs text-gray-400 mb-0.5">Saldo</p>
          <Badge className={
            alDia  ? 'bg-green-100 text-green-700 border-0' :
            aFavor ? 'bg-blue-100 text-blue-700 border-0' :
                     'bg-red-100 text-red-700 border-0'
          }>
            {alDia ? 'Al día' : aFavor ? `A favor ${ars(Math.abs(cliente.saldo_actual))}` : ars(cliente.saldo_actual)}
          </Badge>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {/* Movimientos */}
      {open && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left py-2 px-3 font-medium">Fecha</th>
                <th className="text-left py-2 px-3 font-medium">Tipo</th>
                <th className="text-left py-2 px-3 font-medium">Descripción</th>
                <th className="text-right py-2 px-3 font-medium">Importe</th>
                <th className="text-right py-2 px-3 font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {cliente.movimientos.map(m => <MovRow key={m.id} m={m} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function CtaCteClientesPage() {
  const [clientes, setClientes]   = useState<CtaCteCliente[]>([])
  const [loading, setLoading]     = useState(false)
  const [desde, setDesde]         = useState('')
  const [hasta, setHasta]         = useState('')
  const [clienteFiltro, setClienteFiltro] = useState<Cliente | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (desde)        params.set('desde', desde)
    if (hasta)        params.set('hasta', hasta)
    if (clienteFiltro) params.set('cliente_id', String(clienteFiltro.id))
    const res = await fetch(`/api/dashboard/listados/cobranzas?${params}`)
    if (res.ok) setClientes(await res.json())
    else setClientes([])
    setLoading(false)
  }, [desde, hasta, clienteFiltro])

  useEffect(() => { fetch_() }, [fetch_])

  const totalSaldo = clientes.reduce((s, c) => s + c.saldo_actual, 0)
  const conSaldo   = clientes.filter(c => c.saldo_actual > 0.001).length

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Estado de Cuenta Corriente</h2>
          <p className="text-sm text-gray-400">Clientes</p>
        </div>
        {!loading && clientes.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-gray-400">{conSaldo} cliente{conSaldo !== 1 ? 's' : ''} con saldo</p>
            <p className="text-base font-bold text-gray-900">Total: {ars(totalSaldo)}</p>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <Input type="date" className="w-40" value={desde} onChange={e => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <Input type="date" className="w-40" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
          <div className="w-64">
            <ClienteSearch value={clienteFiltro} onChange={setClienteFiltro} />
          </div>
        </div>
      </div>

      {/* Listado */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando…</div>
      ) : clientes.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">Sin movimientos en cuenta corriente</div>
      ) : (
        <div className="space-y-3">
          {clientes.map(c => <ClienteCard key={c.cliente_id} cliente={c} />)}
        </div>
      )}
    </div>
  )
}
