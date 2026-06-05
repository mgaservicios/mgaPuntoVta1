'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { ArticuloVariante, AtributoTipo, VarianteFormData } from '@/types/articulos'

const varianteSchema = z.object({
  sku:           z.string().min(1, 'El SKU es obligatorio'),
  codigo_barras: z.string().optional(),
  stock_minimo:  z.string().optional(),
  activo:        z.boolean(),
})

type VarianteFormValues = z.infer<typeof varianteSchema>

function toInt(v: string | undefined): number {
  if (!v || v.trim() === '') return 0
  const n = parseInt(v, 10)
  return isNaN(n) ? 0 : n
}

export interface VarianteDialogProps {
  open: boolean
  variante: ArticuloVariante | null
  atributoTipos: AtributoTipo[]
  articuloId: number
  articuloCodigo: string
  onClose: () => void
  onSaved: (v: ArticuloVariante) => void
}

export default function VarianteDialog({
  open, variante, atributoTipos, articuloId, articuloCodigo, onClose, onSaved,
}: VarianteDialogProps) {
  const isNew = variante === null
  const [saving, setSaving] = useState(false)
  const [atributos, setAtributos] = useState<{ atributo_tipo_id: number; valor: string }[]>([])

  const { register, handleSubmit, reset, setValue, formState: { errors: varErrors } } = useForm<VarianteFormValues>({
    resolver: zodResolver(varianteSchema),
    defaultValues: { activo: true },
  })

  useEffect(() => {
    if (!isNew) return
    const vals = atributos
      .filter(a => a.valor.trim())
      .map(a => a.valor.trim().toUpperCase())
    if (vals.length === 0) return
    const parts = [articuloCodigo.trim(), ...vals].filter(Boolean)
    setValue('sku', parts.join('-'))
  }, [atributos, articuloCodigo, isNew, setValue])

  useEffect(() => {
    if (!open) return
    if (variante) {
      reset({
        sku:           variante.sku ?? '',
        codigo_barras: variante.codigo_barras ?? '',
        stock_minimo:  String(variante.stock_minimo),
        activo:        variante.activo,
      })
      setAtributos(
        (variante.variante_atributos ?? []).map((a) => ({
          atributo_tipo_id: a.atributo_tipo_id,
          valor: a.valor,
        }))
      )
    } else {
      reset({ activo: true, stock_minimo: '0' })
      setAtributos([])
    }
  }, [open, variante, reset])

  function addAtributo() {
    if (atributoTipos.length === 0) return
    const usados = atributos.map((a) => a.atributo_tipo_id)
    const disponible = atributoTipos.find((t) => !usados.includes(t.id))
    if (!disponible) return
    setAtributos((prev) => [...prev, { atributo_tipo_id: disponible.id, valor: '' }])
  }

  function removeAtributo(idx: number) {
    setAtributos((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateAtributo(idx: number, field: 'atributo_tipo_id' | 'valor', value: string | number) {
    setAtributos((prev) =>
      prev.map((a, i) => i === idx ? { ...a, [field]: value } : a)
    )
  }

  async function onSubmit(values: VarianteFormValues) {
    setSaving(true)
    const payload: VarianteFormData = {
      sku:           values.sku || undefined,
      codigo_barras: values.codigo_barras || undefined,
      stock_minimo:  toInt(values.stock_minimo),
      activo:        values.activo,
      atributos,
    }

    const url = isNew
      ? `/api/dashboard/articulos/${articuloId}/variantes`
      : `/api/dashboard/articulos/${articuloId}/variantes/${variante!.id}`

    const res = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      const saved = await res.json()
      toast.success(isNew ? 'Variante creada' : 'Variante actualizada')
      onSaved(saved)
      onClose()
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al guardar variante')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Nueva variante' : 'Editar variante'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Atributos</Label>
              <Button type="button" variant="outline" size="sm" onClick={addAtributo}>
                <Plus className="w-3 h-3 mr-1" /> Agregar
              </Button>
            </div>
            {atributos.length === 0 && (
              <p className="text-xs text-gray-400">Sin atributos. Ej: Talle L, Color Rojo.</p>
            )}
            {atributos.map((a, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Select
                  value={String(a.atributo_tipo_id)}
                  onValueChange={(v) => updateAtributo(i, 'atributo_tipo_id', Number(v))}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Tipo">
                      {atributoTipos.find(t => t.id === a.atributo_tipo_id)?.nombre}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {atributoTipos.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="flex-1"
                  placeholder="Valor (ej: XL)"
                  value={a.valor}
                  onChange={(e) => updateAtributo(i, 'valor', e.target.value)}
                />
                <Button
                  type="button" variant="ghost" size="icon"
                  className="text-gray-400 hover:text-red-500"
                  onClick={() => removeAtributo(i)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2.5">
            {/* SKU + Código de barras */}
            <div className="grid grid-cols-2 gap-x-4">
              <div className="flex items-start gap-2">
                <span className="w-20 shrink-0 text-right text-xs text-gray-500 pt-[9px]">SKU *</span>
                <div className="flex-1 min-w-0">
                  <Input {...register('sku')} placeholder="SKU-001" />
                  {varErrors.sku && <p className="text-xs text-red-500 mt-1">{varErrors.sku.message}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-right text-xs text-gray-500">Cód. barras</span>
                <Input {...register('codigo_barras')} placeholder="7790000000000" className="flex-1 min-w-0" />
              </div>
            </div>

            {/* Stock mínimo + Activa */}
            <div className="grid grid-cols-2 gap-x-4">
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-right text-xs text-gray-500">Stock mín.</span>
                <Input {...register('stock_minimo')} type="number" step="1" className="flex-1 min-w-0" />
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded" {...register('activo')} />
                  <span className="text-sm">Activa</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : isNew ? 'Crear' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
