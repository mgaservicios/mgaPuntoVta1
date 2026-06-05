'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { NotaCredito } from '@/types/notas-credito'

type NCDetail = NotaCredito & { clientes?: { nombre: string; email: string | null; telefono: string | null } }

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente', utilizada: 'Utilizada', anulada: 'Anulada',
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function formatMonto(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

export default function NotaCreditoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [nc, setNC] = useState<NCDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [anulando, setAnulando] = useState(false)

  useEffect(() => {
    fetch(`/api/dashboard/notas-credito/${id}`)
      .then(r => r.json())
      .then(data => { setNC(data); setLoading(false) })
  }, [id])

  async function handleAnular() {
    if (!confirm('¿Anular esta nota de crédito? No se puede deshacer.')) return
    setAnulando(true)
    const res = await fetch(`/api/dashboard/notas-credito/${id}/anular`, { method: 'POST' })
    const data = await res.json()
    setAnulando(false)
    if (!res.ok) { toast.error(data.error ?? 'Error al anular'); return }
    toast.success('Nota de crédito anulada')
    setNC(prev => prev ? { ...prev, estado: 'anulada', monto_disponible: 0 } : prev)
  }

  if (loading) return <div className="text-gray-400 py-8 text-center">Cargando…</div>
  if (!nc) return <div className="text-red-500 py-8 text-center">No encontrado</div>

  const usado = nc.monto - nc.monto_disponible

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-800">{nc.numero}</h2>
        </div>
        <Badge variant={
          nc.estado === 'pendiente' ? 'default' :
          nc.estado === 'anulada' ? 'destructive' : 'secondary'
        }>
          {ESTADO_LABELS[nc.estado]}
        </Badge>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Cliente</p>
            <p className="text-sm font-medium text-gray-800">{nc.clientes?.nombre ?? '—'}</p>
            {nc.clientes?.telefono && <p className="text-xs text-gray-400">{nc.clientes.telefono}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Fecha</p>
            <p className="text-sm text-gray-700">{formatFecha(nc.fecha)}</p>
          </div>
        </div>

        <hr className="border-gray-100" />

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Monto original</p>
            <p className="text-sm font-semibold text-gray-800">{formatMonto(nc.monto)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Utilizado</p>
            <p className="text-sm font-semibold text-gray-600">{formatMonto(usado)}</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${nc.monto_disponible > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-400 mb-1">Disponible</p>
            <p className={`text-sm font-bold ${nc.monto_disponible > 0 ? 'text-green-600' : 'text-gray-400'}`}>
              {formatMonto(nc.monto_disponible)}
            </p>
          </div>
        </div>

        {nc.observaciones && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Observaciones</p>
            <p className="text-sm text-gray-600">{nc.observaciones}</p>
          </div>
        )}

        {nc.estado === 'pendiente' && (
          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleAnular}
              disabled={anulando}
            >
              {anulando ? 'Anulando…' : 'Anular nota de crédito'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
