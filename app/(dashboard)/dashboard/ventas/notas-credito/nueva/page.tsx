'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Cliente } from '@/types/clientes'
import ClienteSearch from '@/components/dashboard/ClienteSearch'
import { useVendedores } from '@/hooks/useVendedores'

export default function NuevaNotaCreditoPage() {
  const router = useRouter()
  const vendedores = useVendedores()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [vendedorId, setVendedorId] = useState<number | null>(null)
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [observaciones, setObservaciones] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cliente) { toast.error('Seleccioná un cliente'); return }
    const montoNum = parseFloat(monto)
    if (!montoNum || montoNum <= 0) { toast.error('El monto debe ser mayor a 0'); return }

    setSaving(true)
    const res = await fetch('/api/dashboard/notas-credito', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: cliente.id, monto: montoNum, fecha, observaciones, vendedor_id: vendedorId }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { toast.error(data.error ?? 'Error al crear'); return }
    toast.success(`Nota de crédito ${data.numero} creada`)
    router.push(`/dashboard/ventas/notas-credito/${data.id}`)
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-gray-800">Nueva nota de crédito</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="space-y-1.5">
          <Label>Cliente <span className="text-red-500">*</span></Label>
          <ClienteSearch value={cliente} onChange={setCliente} />
        </div>

        <div className="space-y-1.5">
          <Label>Vendedor</Label>
          <Select value={vendedorId?.toString() ?? ''} onValueChange={v => setVendedorId(Number(v))}>
            <SelectTrigger><SelectValue placeholder="Seleccionar vendedor…" /></SelectTrigger>
            <SelectContent>
              {vendedores.map(v => (
                <SelectItem key={v.id} value={v.id.toString()}>{v.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="monto">Monto <span className="text-red-500">*</span></Label>
          <Input
            id="monto"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={monto}
            onChange={e => setMonto(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="obs">Observaciones</Label>
          <textarea
            id="obs"
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            rows={3}
            placeholder="Motivo de la nota de crédito…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? 'Guardando…' : 'Crear nota de crédito'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
