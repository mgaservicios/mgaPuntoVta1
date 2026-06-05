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
  name:        z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export default function RolFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'nuevo'
  const router = useRouter()
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (isNew) return
    fetch(`/api/dashboard/admin/roles/${id}`)
      .then((r) => r.json())
      .then((data) => reset({ name: data.name, description: data.description ?? '' }))
      .finally(() => setLoading(false))
  }, [id, isNew, reset])

  async function onSubmit(values: FormValues) {
    setSaving(true)
    const res = await fetch(
      isNew ? '/api/dashboard/admin/roles' : `/api/dashboard/admin/roles/${id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, description: values.description || null }),
      }
    )
    setSaving(false)
    if (res.ok) {
      toast.success(isNew ? 'Rol creado' : 'Rol actualizado')
      router.push('/dashboard/admin/roles')
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al guardar')
    }
  }

  if (loading) return <div className="text-gray-400 text-sm">Cargando…</div>

  const lbl = 'w-28 shrink-0 text-right text-xs text-gray-500'

  return (
    <div className="max-w-lg">
      <button
        onClick={() => router.push('/dashboard/admin/roles')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        {isNew ? 'Nuevo rol' : 'Editar rol'}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
        <div className="flex items-start gap-3">
          <span className={`${lbl} pt-[9px]`}>Nombre *</span>
          <div className="flex-1">
            <Input {...register('name')} placeholder="Ej: Vendedor, Supervisor…" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={lbl}>Descripción</span>
          <Input {...register('description')} placeholder="Descripción opcional" className="flex-1" />
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={() => router.push('/dashboard/admin/roles')}>
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
