'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { ListaPrecio } from '@/types/precios'

type FormParams = {
  controla_stock: boolean
  maneja_variantes: boolean
  cantidades_decimales: boolean
  lista_precio_defecto_id: string
}

function SwitchRow({
  label, description, checked, onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          checked ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

export default function ParametrosPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormParams>({
    controla_stock: false,
    maneja_variantes: false,
    cantidades_decimales: false,
    lista_precio_defecto_id: '',
  })
  const [listas, setListas] = useState<ListaPrecio[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/admin/parametros').then(r => r.json()),
      fetch('/api/dashboard/listas-precio').then(r => r.json()),
    ]).then(([paramData, listasData]) => {
      setForm({
        controla_stock: paramData['controla_stock'] === 'true',
        maneja_variantes: paramData['maneja_variantes'] === 'true',
        cantidades_decimales: paramData['cantidades_decimales'] === 'true',
        lista_precio_defecto_id: paramData['lista_precio_defecto_id'] ?? '',
      })
      setListas((Array.isArray(listasData) ? listasData : []).filter((l: ListaPrecio) => l.categoria === 'venta' && l.activo))
    }).finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    const toSave = [
      { clave: 'controla_stock',         valor: String(form.controla_stock) },
      { clave: 'maneja_variantes',        valor: String(form.maneja_variantes) },
      { clave: 'cantidades_decimales',    valor: String(form.cantidades_decimales) },
      { clave: 'lista_precio_defecto_id', valor: form.lista_precio_defecto_id },
    ]
    try {
      const results = await Promise.all(
        toSave.map(p =>
          fetch('/api/dashboard/admin/parametros', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
          })
        )
      )
      const allOk = results.every(r => r.ok)
      if (allOk) {
        toast.success('Parámetros guardados')
      } else {
        toast.error('Error al guardar algunos parámetros')
      }
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-gray-400 text-sm">Cargando…</div>

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">Parámetros del sistema</h2>

      {/* Inventario */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Inventario</p>

        <SwitchRow
          label="Controla stock"
          description="Impide movimientos que dejen stock negativo"
          checked={form.controla_stock}
          onChange={v => setForm(f => ({ ...f, controla_stock: v }))}
        />

        <SwitchRow
          label="Artículos con variantes"
          description="Permite crear artículos con variantes (talle, color, etc.)"
          checked={form.maneja_variantes}
          onChange={v => setForm(f => ({ ...f, maneja_variantes: v }))}
        />

        <SwitchRow
          label="Cantidades con decimales"
          description="Permite ingresar cantidades con decimales en ventas, órdenes y remitos"
          checked={form.cantidades_decimales}
          onChange={v => setForm(f => ({ ...f, cantidades_decimales: v }))}
        />
      </div>

      {/* Ventas */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ventas</p>

        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Lista de precio por defecto</p>
            <p className="text-xs text-gray-400 mt-0.5">Lista seleccionada al abrir el POS</p>
          </div>
          <Select
            value={form.lista_precio_defecto_id}
            onValueChange={v => setForm(f => ({ ...f, lista_precio_defecto_id: v ?? '' }))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Seleccionar…" />
            </SelectTrigger>
            <SelectContent>
              {listas.map(l => (
                <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  )
}
