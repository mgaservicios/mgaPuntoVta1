'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const schema = z.object({
  nombre:    z.string().min(1, 'El nombre es obligatorio'),
  direccion: z.string().optional(),
  activo:    z.boolean(),
})
type FormValues = z.infer<typeof schema>

export default function SucursalFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'nueva'
  const router = useRouter()
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { activo: true },
  })

  useEffect(() => {
    if (isNew) return
    fetch(`/api/dashboard/admin/sucursales/${id}`)
      .then((r) => r.json())
      .then((data) => reset({
        nombre:    data.nombre,
        direccion: data.direccion ?? '',
        activo:    data.activo,
      }))
      .finally(() => setLoading(false))
  }, [id, isNew, reset])

  async function onSubmit(values: FormValues) {
    setSaving(true)
    const res = await fetch(
      isNew ? '/api/dashboard/admin/sucursales' : `/api/dashboard/admin/sucursales/${id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, direccion: values.direccion || null }),
      }
    )
    setSaving(false)
    if (res.ok) {
      toast.success(isNew ? 'Sucursal creada' : 'Sucursal actualizada')
      router.push('/dashboard/admin/sucursales')
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al guardar')
    }
  }

  if (loading) return <div className="text-gray-400 text-sm">Cargando…</div>

  return (
    <div className="max-w-lg">
      <button
        onClick={() => router.push('/dashboard/admin/sucursales')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        {isNew ? 'Nueva sucursal' : 'Editar sucursal'}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
        <div className="flex items-start gap-3">
          <span className="w-24 shrink-0 text-right text-xs text-gray-500 pt-[9px]">Nombre *</span>
          <div className="flex-1">
            <Input {...register('nombre')} placeholder="Nombre de la sucursal" />
            {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre.message}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-right text-xs text-gray-500">Dirección</span>
          <Input {...register('direccion')} placeholder="Dirección física" className="flex-1" />
        </div>

        {!isNew && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="activo"
              checked={watch('activo')}
              onChange={(e) => setValue('activo', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            <label htmlFor="activo" className="text-sm cursor-pointer">Sucursal activa</label>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={() => router.push('/dashboard/admin/sucursales')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
