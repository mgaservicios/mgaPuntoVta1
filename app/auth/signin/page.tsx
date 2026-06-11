'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff, Loader2, AlertCircle, Building2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const schema = z.object({
  empresa_codigo: z.string().min(1, 'El código de empresa es obligatorio'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormData = z.infer<typeof schema>

type SucursalOption = { id: number; nombre: string }

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; name: string; isAdmin: boolean; sucursales: SucursalOption[] }
  | { status: 'empresa_not_found' }
  | { status: 'user_not_found' }

export default function SignInPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' })
  const [selectedSucursalId, setSelectedSucursalId] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const lookupUser = async () => {
    const { empresa_codigo, email } = getValues()
    if (!empresa_codigo || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return

    setLookup({ status: 'loading' })
    try {
      const res = await fetch('/api/auth/lookup-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_codigo, email }),
      })
      const data = await res.json()
      if (!res.ok || !data.found) {
        setLookup({ status: data.reason === 'empresa_not_found' ? 'empresa_not_found' : 'user_not_found' })
        setSelectedSucursalId(null)
        return
      }
      setLookup({
        status: 'found',
        name: data.name,
        isAdmin: data.isAdmin,
        sucursales: data.sucursales,
      })
      const defaultSuc = data.sucursales.find((s: SucursalOption) => s.id === 1) ?? data.sucursales[0]
      setSelectedSucursalId(defaultSuc?.id ?? null)
    } catch {
      setLookup({ status: 'idle' })
    }
  }

  const onSubmit = async (data: FormData) => {
    setError(null)

    if (lookup.status === 'empresa_not_found') {
      setError('No existe ninguna empresa con ese código.')
      return
    }
    if (lookup.status === 'user_not_found') {
      setError('El email no está registrado en esta empresa.')
      return
    }

    setIsSubmitting(true)

    const result = await signIn('credentials', {
      empresa_codigo: data.empresa_codigo.toUpperCase().trim(),
      email: data.email,
      password: data.password,
      redirect: false,
    })

    setIsSubmitting(false)

    if (!result || result.error) {
      setError('Contraseña incorrecta.')
      return
    }

    const initUrl = selectedSucursalId
      ? `/api/auth/init-session?sucursal_id=${selectedSucursalId}`
      : '/api/auth/init-session'

    // Mark this as an active browser session — SessionGuard checks this on every
    // dashboard load and signs out if missing (e.g. browser was closed and reopened).
    sessionStorage.setItem('session_active', '1')

    // Full navigation so the Set-Cookie from the route handler is applied before /dashboard renders
    window.location.href = initUrl
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Iniciar sesión</h2>
      <p className="text-sm text-gray-500 mb-6">Ingresá con tu cuenta</p>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 mb-5 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="empresa_codigo">Código de empresa</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="empresa_codigo"
              type="text"
              placeholder="Ej: MGA2025"
              autoComplete="organization"
              className={`pl-9 uppercase ${errors.empresa_codigo || lookup.status === 'empresa_not_found' ? 'border-red-400' : ''}`}
              {...register('empresa_codigo', {
                onChange: () => { if (lookup.status !== 'idle' && lookup.status !== 'loading') setLookup({ status: 'idle' }) },
              })}
              onBlur={lookupUser}
            />
          </div>
          {errors.empresa_codigo && (
            <p className="text-xs text-red-600">{errors.empresa_codigo.message}</p>
          )}
          {lookup.status === 'empresa_not_found' && (
            <p className="text-xs text-red-600">No existe ninguna empresa con ese código.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@email.com"
            autoComplete="email"
            {...register('email', {
              onChange: () => { if (lookup.status === 'user_not_found') setLookup({ status: 'idle' }) },
            })}
            className={errors.email || lookup.status === 'user_not_found' ? 'border-red-400' : ''}
            onBlur={lookupUser}
          />
          {errors.email && (
            <p className="text-xs text-red-600">{errors.email.message}</p>
          )}
          {lookup.status === 'user_not_found' && (
            <p className="text-xs text-red-600">El email no está registrado en esta empresa.</p>
          )}
        </div>

        {lookup.status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Verificando...
          </div>
        )}

        {lookup.status === 'found' && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-gray-600">
              <MapPin className="w-3.5 h-3.5" />
              Sucursal asignada
            </Label>
            {lookup.isAdmin && lookup.sucursales.length > 1 ? (
              <Select
                value={selectedSucursalId ? String(selectedSucursalId) : undefined}
                onValueChange={(v) => setSelectedSucursalId(v ? parseInt(v, 10) : null)}
                items={Object.fromEntries(lookup.sucursales.map((s) => [String(s.id), s.nombre]))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {lookup.sucursales.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-md text-sm text-blue-800">
                <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                {lookup.sucursales[0]?.nombre ?? '—'}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••"
              autoComplete="current-password"
              {...register('password')}
              className={errors.password ? 'border-red-400 pr-10' : 'pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full mt-2" disabled={isSubmitting}>
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ingresando...</>
          ) : (
            'Ingresar'
          )}
        </Button>
      </form>
    </>
  )
}
