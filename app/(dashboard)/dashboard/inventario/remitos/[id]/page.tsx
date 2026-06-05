'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import type { Remito } from '@/types/stock'

type RemitoDetail = Remito & { sucursal_nombre: string; contraparte_display: string }

const TIPO_LABELS: Record<string, string> = { entrada: 'Entrada', salida: 'Salida' }
const ESTADO_LABELS: Record<string, string> = { borrador: 'Borrador', confirmado: 'Confirmado', anulado: 'Anulado' }
const CONTRAPARTE_LABELS: Record<string, string> = { sucursal: 'Sucursal', proveedor: 'Proveedor', persona: 'Persona' }

export default function RemitoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [remito, setRemito] = useState<RemitoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [anulando, setAnulando] = useState(false)
  const [showAnularDialog, setShowAnularDialog] = useState(false)

  useEffect(() => {
    fetch(`/api/dashboard/stock/remitos/${id}`)
      .then(r => r.json())
      .then(data => {
        setRemito(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  async function handleConfirmar() {
    setConfirming(true)
    const res = await fetch(`/api/dashboard/stock/remitos/${id}/confirmar`, { method: 'POST' })
    setConfirming(false)
    if (res.ok) {
      toast.success('Remito confirmado — stock actualizado')
      setRemito(prev => prev ? { ...prev, estado: 'confirmado' } : prev)
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al confirmar')
    }
  }

  async function handleAnular() {
    setAnulando(true)
    const res = await fetch(`/api/dashboard/stock/remitos/${id}/anular`, { method: 'POST' })
    setAnulando(false)
    setShowAnularDialog(false)
    if (res.ok) {
      toast.success('Remito anulado — stock revertido')
      setRemito(prev => prev ? { ...prev, estado: 'anulado' } : prev)
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al anular')
    }
  }

  function formatFecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function formatNum(n: number | null) {
    if (n === null || n === undefined) return '—'
    return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  if (loading) return <div className="text-gray-400 text-sm">Cargando…</div>
  if (!remito) return <div className="text-red-500 text-sm">Remito no encontrado</div>

  const items = remito.remito_items ?? []

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => router.push('/dashboard/inventario/remitos')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-semibold text-gray-800 font-mono">{remito.numero}</h2>
            <Badge variant={remito.tipo === 'entrada' ? 'default' : 'secondary'}>
              {TIPO_LABELS[remito.tipo]}
            </Badge>
            <Badge
              variant={remito.estado === 'confirmado' ? 'default' : remito.estado === 'anulado' ? 'destructive' : 'outline'}
            >
              {ESTADO_LABELS[remito.estado]}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">{formatFecha(remito.fecha)}</p>
        </div>

        <div className="flex gap-2">
          {remito.estado === 'borrador' && (
            <Button onClick={handleConfirmar} disabled={confirming}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {confirming ? 'Confirmando…' : 'Confirmar'}
            </Button>
          )}
          {remito.estado === 'confirmado' && (
            <Button variant="outline" className="text-red-500 hover:text-red-600" onClick={() => setShowAnularDialog(true)}>
              <XCircle className="w-4 h-4 mr-2" />
              Anular
            </Button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Sucursal</p>
          <p className="text-sm font-medium text-gray-800">{remito.sucursal_nombre}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">{remito.tipo === 'entrada' ? 'Origen' : 'Destino'}</p>
          <p className="text-sm font-medium text-gray-800">
            <span className="text-gray-400 font-normal mr-1">{CONTRAPARTE_LABELS[remito.contraparte_tipo]}</span>
            {remito.contraparte_display}
          </p>
        </div>
        {remito.observaciones && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400 mb-0.5">Observaciones</p>
            <p className="text-sm text-gray-700">{remito.observaciones}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Artículo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 w-32">SKU / Variante</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600 w-24">Cantidad</th>
              {remito.tipo === 'entrada' && (
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Costo unit.</th>
              )}
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
                  <div className="font-medium text-gray-800">{item.articulos?.nombre ?? `#${item.articulo_id}`}</div>
                  {item.articulos?.codigo && (
                    <div className="text-xs text-gray-400 font-mono">{item.articulos.codigo}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                  {item.articulo_variantes?.sku ?? (item.variante_id ? `#${item.variante_id}` : '—')}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">
                  {item.cantidad.toLocaleString('es-AR')}
                </td>
                {remito.tipo === 'entrada' && (
                  <td className="px-4 py-3 text-right text-gray-600">
                    {item.costo_unitario !== null ? `$${formatNum(item.costo_unitario)}` : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={showAnularDialog}
        title="Anular remito"
        description="Esta acción revertirá los movimientos de stock asociados a este remito. ¿Confirmás?"
        confirmLabel="Anular"
        loading={anulando}
        onConfirm={handleAnular}
        onCancel={() => setShowAnularDialog(false)}
      />
    </div>
  )
}
