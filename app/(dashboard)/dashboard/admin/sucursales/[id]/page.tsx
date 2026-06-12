'use client'

import { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const schema = z.object({
  nombre:    z.string().min(1, 'El nombre es obligatorio'),
  direccion: z.string().optional(),
  activo:    z.boolean(),
  color:     z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export default function SucursalFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'nueva'
  const router = useRouter()
  const [loading, setLoading]       = useState(!isNew)
  const [saving, setSaving]         = useState(false)
  const [logoUrl, setLogoUrl]       = useState<string | null>(null)
  const [uploading, setUploading]   = useState(false)
  const fileInputRef                = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { activo: true, color: '#0D1525' },
  })

  useEffect(() => {
    if (isNew) return
    fetch(`/api/dashboard/admin/sucursales/${id}`)
      .then((r) => r.json())
      .then((data) => {
        reset({
          nombre:    data.nombre,
          direccion: data.direccion ?? '',
          activo:    data.activo,
          color:     data.color ?? '#0D1525',
        })
        setLogoUrl(data.logo_url ?? null)
      })
      .finally(() => setLoading(false))
  }, [id, isNew, reset])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/dashboard/admin/sucursales/upload-logo', { method: 'POST', body: fd })
    setUploading(false)
    if (res.ok) {
      const { url } = await res.json()
      setLogoUrl(url)
      toast.success('Logo subido')
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al subir logo')
    }
    // reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function onSubmit(values: FormValues) {
    setSaving(true)
    const res = await fetch(
      isNew ? '/api/dashboard/admin/sucursales' : `/api/dashboard/admin/sucursales/${id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          direccion: values.direccion || null,
          color: values.color || null,
          logo_url: logoUrl,
        }),
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

  const colorValue = watch('color') ?? '#0D1525'

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

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">

        {/* Nombre */}
        <div className="flex items-start gap-3">
          <span className="w-24 shrink-0 text-right text-xs text-gray-500 pt-[9px]">Nombre *</span>
          <div className="flex-1">
            <Input {...register('nombre')} placeholder="Nombre de la sucursal" />
            {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre.message}</p>}
          </div>
        </div>

        {/* Dirección */}
        <div className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-right text-xs text-gray-500">Dirección</span>
          <Input {...register('direccion')} placeholder="Dirección física" className="flex-1" />
        </div>

        {/* Color */}
        <div className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-right text-xs text-gray-500">Color</span>
          <div className="flex items-center gap-3 flex-1">
            <div
              className="w-9 h-9 rounded-lg border border-gray-200 overflow-hidden cursor-pointer shrink-0"
              onClick={() => document.getElementById('color-input')?.click()}
            >
              <input
                id="color-input"
                type="color"
                {...register('color')}
                className="w-12 h-12 -m-1.5 cursor-pointer border-0 p-0"
              />
            </div>
            <div className="flex-1">
              <Input
                value={colorValue}
                onChange={(e) => setValue('color', e.target.value)}
                placeholder="#0D1525"
                className="font-mono text-sm"
              />
            </div>
            <div
              className="w-28 h-9 rounded-lg flex items-center justify-center text-xs font-medium shrink-0"
              style={{ backgroundColor: colorValue, color: '#ffffff' }}
            >
              Vista previa
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="flex items-start gap-3">
          <span className="w-24 shrink-0 text-right text-xs text-gray-500 pt-2">Logo</span>
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleLogoUpload}
            />
            {logoUrl ? (
              <div className="flex items-start gap-3">
                <div className="w-32 h-16 rounded-lg border border-gray-200 bg-gray-800 flex items-center justify-center overflow-hidden">
                  {/* dark bg to preview light logos */}
                  <img src={logoUrl} alt="Logo" className="max-h-14 max-w-full object-contain" />
                </div>
                <div className="flex flex-col gap-1.5 mt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {uploading ? 'Subiendo…' : 'Cambiar logo'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => setLogoUrl(null)}
                  >
                    <X className="w-3.5 h-3.5 mr-1.5" />
                    Quitar logo
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full h-16 border-dashed"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Subiendo…' : 'Subir logo (JPG, PNG, WebP, SVG)'}
              </Button>
            )}
          </div>
        </div>

        {/* Activo */}
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
