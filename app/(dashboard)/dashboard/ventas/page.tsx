'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Eye, Printer } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { Venta } from '@/types/ventas'

type VentaRow = Pick<Venta, 'id' | 'numero' | 'fecha' | 'estado' | 'subtotal' | 'descuento_monto' | 'total'> & {
  clientes?: { nombre: string } | null
  users?: { name: string | null; email: string } | null
  nombre_sucursal?: string | null
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function VentasPage() {
  const [ventas, setVentas] = useState<VentaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [estado, setEstado] = useState('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const fetchVentas = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (estado !== 'todos') params.set('estado', estado)
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    const res = await fetch(`/api/dashboard/ventas?${params}`)
    const data = await res.json()
    setVentas(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [estado, desde, hasta])

  useEffect(() => { fetchVentas() }, [fetchVentas])

  const totalPeriodo = ventas.filter(v => v.estado === 'completada').reduce((acc, v) => acc + v.total, 0)
  const showSucursal = ventas.some(v => v.nombre_sucursal)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Historial de ventas</h2>
        <Link href="/dashboard/ventas/pos" className={buttonVariants()}>
          Ir al POS
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="w-44">
          <Select value={estado} onValueChange={(v) => { if (v) setEstado(v) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="completada">Completada</SelectItem>
              <SelectItem value="anulada">Anulada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          type="date"
          className="w-40"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          placeholder="Desde"
        />
        <Input
          type="date"
          className="w-40"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          placeholder="Hasta"
        />
      </div>

      {/* Resumen */}
      {ventas.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-blue-700">{ventas.filter(v => v.estado === 'completada').length} ventas completadas</span>
          <span className="text-sm font-semibold text-blue-800">{formatARS(totalPeriodo)}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">N°</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              {showSucursal && <TableHead className="w-40">Sucursal</TableHead>}
              <TableHead>Cliente</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right w-32">Total</TableHead>
              <TableHead className="w-28">Estado</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={showSucursal ? 8 : 7} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : ventas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showSucursal ? 8 : 7} className="text-center py-8 text-gray-400">Sin ventas en el período</TableCell>
              </TableRow>
            ) : ventas.map(v => (
              <TableRow key={v.id} className={v.estado === 'anulada' ? 'opacity-50' : ''}>
                <TableCell className="font-mono font-medium text-sm">{v.numero}</TableCell>
                <TableCell className="text-gray-600 text-sm">{formatFecha(v.fecha)}</TableCell>
                {showSucursal && (
                  <TableCell className="text-xs text-gray-500">{v.nombre_sucursal ?? '—'}</TableCell>
                )}
                <TableCell className="text-sm text-gray-700">{v.clientes?.nombre ?? <span className="text-gray-400">Consumidor final</span>}</TableCell>
                <TableCell className="text-sm text-gray-600">{v.users?.name || v.users?.email || '—'}</TableCell>
                <TableCell className="text-right font-medium">{formatARS(v.total)}</TableCell>
                <TableCell>
                  <Badge variant={v.estado === 'completada' ? 'default' : 'destructive'}>
                    {v.estado === 'completada' ? 'Completada' : 'Anulada'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    {v.estado === 'completada' && (
                      <Link
                        href={`/dashboard/ventas/${v.id}/print`}
                        target="_blank"
                        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                        title="Imprimir ticket"
                      >
                        <Printer className="w-4 h-4" />
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/ventas/${v.id}`}
                      className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                      title="Ver detalle"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
