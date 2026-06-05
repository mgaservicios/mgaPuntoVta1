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
import type { Sucursal } from '@/types/sucursales'
import type { Role } from '@/types/auth'

const schema = z.object({
  name:     z.string().min(1, 'El nombre es obligatorio'),
  email:    z.string().email('Email inválido'),
  password: z.string().optional(),
  role_id:  z.string().min(1, 'Seleccioná un rol'),
})
type FormValues = z.infer<typeof schema>

export default function UsuarioFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'nuevo'
  const router = useRouter()
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [sucursalIds, setSucursalIds] = useState<number[]>([])

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {},
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/admin/roles-list').then((r) => r.json()),
      fetch('/api/dashboard/admin/sucursales').then((r) => r.json()),
    ]).then(([r, s]) => {
      setRoles(r)
      setSucursales(s)
    })

    if (isNew) return
    fetch(`/api/dashboard/admin/usuarios/${id}`)
      .then((r) => r.json())
      .then((data) => {
        reset({
          name:    data.name,
          email:   data.email,
          role_id: String(data.role_id),
        })
        setSucursalIds(data.user_sucursales?.map((us: { sucursal_id: number }) => us.sucursal_id) ?? [])
      })
      .finally(() => setLoading(false))
  }, [id, isNew, reset])

  function toggleSucursal(sid: number) {
    setSucursalIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    )
  }

  async function onSubmit(values: FormValues) {
    if (isNew && !values.password) {
      toast.error('La contraseña es obligatoria para usuarios nuevos')
      return
    }
    setSaving(true)
    const payload = {
      ...values,
      role_id: parseInt(values.role_id, 10),
      sucursal_ids: sucursalIds,
      password: values.password || undefined,
    }
    const res = await fetch(
      isNew ? '/api/dashboard/admin/usuarios' : `/api/dashboard/admin/usuarios/${id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    setSaving(false)
    if (res.ok) {
      toast.success(isNew ? 'Usuario creado' : 'Usuario actualizado')
      router.push('/dashboard/admin/usuarios')
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
        onClick={() => router.push('/dashboard/admin/usuarios')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        {isNew ? 'Nuevo usuario' : 'Editar usuario'}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
        <div className="flex items-start gap-3">
          <span className={`${lbl} pt-[9px]`}>Nombre *</span>
          <div className="flex-1">
            <Input {...register('name')} placeholder="Nombre completo" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className={`${lbl} pt-[9px]`}>Email *</span>
          <div className="flex-1">
            <Input {...register('email')} type="email" placeholder="usuario@email.com" />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={lbl}>{isNew ? 'Contraseña *' : 'Nueva clave'}</span>
          <Input
            {...register('password')}
            type="password"
            placeholder={isNew ? 'Mínimo 6 caracteres' : 'Dejar en blanco para no cambiar'}
            className="flex-1"
          />
        </div>

        <div className="flex items-start gap-3">
          <span className={`${lbl} pt-[9px]`}>Rol *</span>
          <div className="flex-1">
            <Select value={watch('role_id')} onValueChange={(v) => { if (v) setValue('role_id', v) }}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar rol">
                  {roles.find((r) => String(r.id) === watch('role_id'))?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role_id && <p className="text-xs text-red-500 mt-1">{errors.role_id.message}</p>}
          </div>
        </div>

        {sucursales.length > 0 && (
          <div className="flex items-start gap-3 pt-1">
            <span className={`${lbl} pt-1`}>Sucursales</span>
            <div className="flex-1 grid grid-cols-2 gap-1.5">
              {sucursales.map((s) => (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={sucursalIds.includes(s.id)}
                    onChange={() => toggleSucursal(s.id)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                  {s.nombre}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={() => router.push('/dashboard/admin/usuarios')}>
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
