'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Printer } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { Venta, MetodoPago } from '@/types/ventas'

const METODO_LABELS: Record<MetodoPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA_DEBITO: 'Tarjeta débito',
  TARJETA_CREDITO: 'Tarjeta crédito',
  CUENTA_CORRIENTE: 'Cuenta corriente',
  NOTA_CREDITO: 'Nota de crédito',
  OTRO: 'Otro',
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function VentaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [venta, setVenta] = useState<Venta | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/dashboard/ventas/${id}`)
      .then(r => r.json())
      .then(data => { setVenta(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-gray-400 text-sm">Cargando…</div>
  if (!venta) return <div className="text-red-500 text-sm">Venta no encontrada</div>

  const items = venta.venta_items ?? []
  const pagos = venta.venta_pagos ?? []

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => router.push('/dashboard/ventas')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-semibold text-gray-800 font-mono">{venta.numero}</h2>
            <Badge variant={venta.estado === 'completada' ? 'default' : 'destructive'}>
              {venta.estado === 'completada' ? 'Completada' : 'Anulada'}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">{formatFecha(venta.fecha)}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/ventas/${id}/print`}
            target="_blank"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir ticket
          </Link>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Cliente</p>
          <p className="text-sm font-medium text-gray-800">{venta.clientes?.nombre ?? 'Consumidor final'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Vendedor</p>
          <p className="text-sm font-medium text-gray-800">
            {(venta.users as { name: string | null; email: string } | null)?.name || (venta.users as { name: string | null; email: string } | null)?.email || '—'}
          </p>
        </div>
        {venta.observaciones && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400 mb-0.5">Observaciones</p>
            <p className="text-sm text-gray-700">{venta.observaciones}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Artículo</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 w-24">Cantidad</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Precio unit.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-400">Sin ítems</td>
              </tr>
            ) : items.map(item => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{item.nombre_articulo}</p>
                  {item.descripcion_variante && (
                    <p className="text-xs text-gray-400">{item.descripcion_variante}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  {Number(item.cantidad).toLocaleString('es-AR')}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {formatARS(item.precio_unitario)}
                  {item.descuento_pct > 0 && (
                    <span className="text-xs text-red-400 ml-1">-{item.descuento_pct}%</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">
                  {formatARS(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totales + Pagos */}
      <div className="grid grid-cols-2 gap-4">

        {/* Pagos */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pagos</p>
          <div className="space-y-2">
            {pagos.map(p => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{METODO_LABELS[p.metodo]}</span>
                <span className="font-medium">{formatARS(p.monto)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totales */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Totales</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span>{formatARS(venta.subtotal)}</span>
          </div>
          {venta.descuento_monto > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Descuento ({venta.descuento_pct}%)</span>
              <span className="text-red-500">-{formatARS(venta.descuento_monto)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold border-t border-gray-100 pt-2">
            <span>Total</span>
            <span>{formatARS(venta.total)}</span>
          </div>
        </div>
      </div>

    </div>
  )
}
