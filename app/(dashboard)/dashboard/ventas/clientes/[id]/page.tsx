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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { ClienteFormData } from '@/types/clientes'

const schema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  tipo: z.enum(['PARTICULAR', 'EMPRESA', 'COMERCIO']),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  localidad: z.string().optional(),
  cuit: z.string().optional(),
  notas: z.string().optional(),
  activo: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export default function ClienteFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'nuevo'
  const router = useRouter()
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'PARTICULAR', activo: true },
  })

  useEffect(() => {
    if (isNew) return
    fetch(`/api/dashboard/clientes/${id}`)
      .then((r) => r.json())
      .then((data) => {
        reset({
          nombre: data.nombre,
          tipo: data.tipo,
          email: data.email ?? '',
          telefono: data.telefono ?? '',
          direccion: data.direccion ?? '',
          localidad: data.localidad ?? '',
          cuit: data.cuit ?? '',
          notas: data.notas ?? '',
          activo: data.activo,
        })
      })
      .finally(() => setLoading(false))
  }, [id, isNew, reset])

  async function onSubmit(values: FormValues) {
    setSaving(true)
    const payload: ClienteFormData = {
      ...values,
      email: values.email || undefined,
      telefono: values.telefono || undefined,
      direccion: values.direccion || undefined,
      localidad: values.localidad || undefined,
      cuit: values.cuit || undefined,
      notas: values.notas || undefined,
    }

    const res = await fetch(
      isNew ? '/api/dashboard/clientes' : `/api/dashboard/clientes/${id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    if (res.ok) {
      toast.success(isNew ? 'Cliente creado' : 'Cliente actualizado')
      router.push('/dashboard/ventas/clientes')
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
        {isNew ? 'Nuevo cliente' : 'Editar cliente'}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">

        {/* Nombre */}
        <div className="flex items-start gap-3">
          <span className={`${lbl} pt-[9px]`}>Nombre *</span>
          <div className="flex-1">
            <Input {...register('nombre')} placeholder="Nombre completo o razón social" />
            {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre.message}</p>}
          </div>
        </div>

        {/* Tipo + CUIT */}
        <div className="grid grid-cols-2 gap-x-6">
          <div className="flex items-center gap-3">
            <span className={lbl}>Tipo</span>
            <Select value={watch('tipo')} onValueChange={(v) => setValue('tipo', v as FormValues['tipo'])}>
              <SelectTrigger className="flex-1 min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PARTICULAR">Particular</SelectItem>
                <SelectItem value="EMPRESA">Empresa</SelectItem>
                <SelectItem value="COMERCIO">Comercio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <span className={lbl}>CUIT</span>
            <Input {...register('cuit')} placeholder="20-12345678-9" className="flex-1 min-w-0" />
          </div>
        </div>

        {/* Teléfono + Email */}
        <div className="grid grid-cols-2 gap-x-6">
          <div className="flex items-center gap-3">
            <span className={lbl}>Teléfono</span>
            <Input {...register('telefono')} placeholder="2994 123456" className="flex-1 min-w-0" />
          </div>
          <div className="flex items-start gap-3">
            <span className={`${lbl} pt-[9px]`}>Email</span>
            <div className="flex-1 min-w-0">
              <Input {...register('email')} type="email" placeholder="mail@ejemplo.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
          </div>
        </div>

        {/* Dirección + Localidad */}
        <div className="grid grid-cols-2 gap-x-6">
          <div className="flex items-center gap-3">
            <span className={lbl}>Dirección</span>
            <Input {...register('direccion')} placeholder="Calle 123" className="flex-1 min-w-0" />
          </div>
          <div className="flex items-center gap-3">
            <span className={lbl}>Localidad</span>
            <Input {...register('localidad')} placeholder="Ciudad" className="flex-1 min-w-0" />
          </div>
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
            {saving ? 'Guardando…' : isNew ? 'Crear cliente' : 'Guardar cambios'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
