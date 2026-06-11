'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Eye } from 'lucide-react'
import { usePermissions } from '@/components/PermissionsProvider'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { NotaCredito } from '@/types/notas-credito'

type NCRow = NotaCredito & { clientes?: { nombre: string } }

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', utilizada: 'Utilizada', anulada: 'Anulada',
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function formatMonto(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

export default function NotasCreditoPage() {
  const { can } = usePermissions()
  const [items, setItems] = useState<NCRow[]>([])
  const [loading, setLoading] = useState(true)
  const [estado, setEstado] = useState('todos')
  const [q, setQ] = useState('')

  const fetchNC = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (estado !== 'todos') params.set('estado', estado)
    const res = await fetch(`/api/dashboard/notas-credito?${params}`)
    const data = await res.json()
    const filtered = Array.isArray(data) ? data : []
    setItems(
      q
        ? filtered.filter((nc: NCRow) =>
            nc.numero.toLowerCase().includes(q.toLowerCase()) ||
            nc.clientes?.nombre.toLowerCase().includes(q.toLowerCase())
          )
        : filtered
    )
    setLoading(false)
  }, [estado, q])

  useEffect(() => {
    const t = setTimeout(fetchNC, 300)
    return () => clearTimeout(t)
  }, [fetchNC])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Notas de crédito</h2>
        {can('ventas.notas-credito.crear') && (
          <Link href="/dashboard/ventas/notas-credito/nueva" className={buttonVariants()}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva nota de crédito
          </Link>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <Input
          placeholder="Buscar por número o cliente…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="max-w-xs"
        />
        <div className="w-48">
          <Select value={estado} onValueChange={v => { if (v) setEstado(v) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="utilizada">Utilizada</SelectItem>
              <SelectItem value="anulada">Anulada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">N°</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="w-32">Fecha</TableHead>
              <TableHead className="w-36 text-right">Monto original</TableHead>
              <TableHead className="w-36 text-right">Disponible</TableHead>
              <TableHead className="w-32">Estado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">Sin notas de crédito</TableCell>
              </TableRow>
            ) : items.map(nc => (
              <TableRow key={nc.id}>
                <TableCell className="font-mono font-medium text-sm">{nc.numero}</TableCell>
                <TableCell className="text-sm">{nc.clientes?.nombre ?? '—'}</TableCell>
                <TableCell className="text-gray-600 text-sm">{formatFecha(nc.fecha)}</TableCell>
                <TableCell className="text-right text-sm">{formatMonto(nc.monto)}</TableCell>
                <TableCell className={`text-right text-sm font-medium ${nc.monto_disponible > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                  {formatMonto(nc.monto_disponible)}
                </TableCell>
                <TableCell>
                  <Badge variant={
                    nc.estado === 'pendiente' ? 'default' :
                    nc.estado === 'anulada' ? 'destructive' : 'secondary'
                  }>
                    {ESTADO_LABELS[nc.estado]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/dashboard/ventas/notas-credito/${nc.id}`}
                    className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
