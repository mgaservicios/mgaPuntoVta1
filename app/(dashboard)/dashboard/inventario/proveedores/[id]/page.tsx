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
import type { ProveedorFormData } from '@/types/proveedores'

const schema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  cuit: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  direccion: z.string().optional(),
  localidad: z.string().optional(),
  notas: z.string().optional(),
  activo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export default function ProveedorFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'nuevo'
  const router = useRouter()
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { activo: true },
  })

  useEffect(() => {
    if (isNew) return
    fetch(`/api/dashboard/proveedores/${id}`)
      .then((r) => r.json())
      .then((data) => {
        reset({
          nombre: data.nombre,
          cuit: data.cuit ?? '',
          telefono: data.telefono ?? '',
          email: data.email ?? '',
          direccion: data.direccion ?? '',
          localidad: data.localidad ?? '',
          notas: data.notas ?? '',
          activo: data.activo,
        })
      })
      .finally(() => setLoading(false))
  }, [id, isNew, reset])

  async function onSubmit(values: FormValues) {
    setSaving(true)
    const payload: ProveedorFormData = {
      ...values,
      cuit: values.cuit || undefined,
      telefono: values.telefono || undefined,
      email: values.email || undefined,
      direccion: values.direccion || undefined,
      localidad: values.localidad || undefined,
      notas: values.notas || undefined,
    }

    const res = await fetch(
      isNew ? '/api/dashboard/proveedores' : `/api/dashboard/proveedores/${id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    if (res.ok) {
      toast.success(isNew ? 'Proveedor creado' : 'Proveedor actualizado')
      router.push('/dashboard/inventario/proveedores')
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al guardar')
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="text-gray-400">Cargando…</div>
  }

  const lbl = 'w-24 shrink-0 text-right text-xs text-gray-500'

  return (
    <div className="max-w-2xl">
      <Button variant="ghost" className="mb-4 -ml-2" onClick={() => router.back()}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver
      </Button>

      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {isNew ? 'Nuevo proveedor' : 'Editar proveedor'}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">

        {/* Nombre */}
        <div className="flex items-start gap-3">
          <span className={`${lbl} pt-[9px]`}>Nombre *</span>
          <div className="flex-1">
            <Input {...register('nombre')} placeholder="Nombre o razón social" />
            {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre.message}</p>}
          </div>
        </div>

        {/* CUIT + Teléfono */}
        <div className="grid grid-cols-2 gap-x-6">
          <div className="flex items-center gap-3">
            <span className={lbl}>CUIT</span>
            <Input {...register('cuit')} placeholder="20-12345678-9" className="flex-1 min-w-0" />
          </div>
          <div className="flex items-center gap-3">
            <span className={lbl}>Teléfono</span>
            <Input {...register('telefono')} placeholder="2994 123456" className="flex-1 min-w-0" />
          </div>
        </div>

        {/* Email + Localidad */}
        <div className="grid grid-cols-2 gap-x-6">
          <div className="flex items-start gap-3">
            <span className={`${lbl} pt-[9px]`}>Email</span>
            <div className="flex-1 min-w-0">
              <Input {...register('email')} type="email" placeholder="mail@ejemplo.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={lbl}>Localidad</span>
            <Input {...register('localidad')} placeholder="Ciudad" className="flex-1 min-w-0" />
          </div>
        </div>

        {/* Dirección */}
        <div className="flex items-center gap-3">
          <span className={lbl}>Dirección</span>
          <Input {...register('direccion')} placeholder="Calle 123" className="flex-1" />
        </div>

        {/* Notas */}
        <div className="flex items-center gap-3">
          <span className={lbl}>Notas</span>
          <Input {...register('notas')} placeholder="Observaciones internas" className="flex-1" />
        </div>

        {!isNew && (
          <div className="flex items-center gap-2 pt-1">
            <input
              id="activo"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={watch('activo')}
              onChange={(e) => setValue('activo', e.target.checked)}
            />
            <label htmlFor="activo" className="text-sm cursor-pointer">Activo</label>
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : isNew ? 'Crear proveedor' : 'Guardar cambios'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
