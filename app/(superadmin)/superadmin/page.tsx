'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface Empresa {
  id: string
  nombre: string
  codigo: string
  activo: boolean
  estado_implementacion: string
}

type ResetState =
  | { phase: 'idle' }
  | { phase: 'confirming'; empresa: Empresa; typedCode: string }
  | { phase: 'loading'; empresa: Empresa }

interface SetupForm {
  nombre: string
  email: string
  password: string
  nombre_sucursal: string
}

type SetupState =
  | { phase: 'idle' }
  | { phase: 'form'; empresa: Empresa; form: SetupForm }
  | { phase: 'loading'; empresa: Empresa }

const emptyForm = (): SetupForm => ({ nombre: '', email: '', password: '', nombre_sucursal: '' })

export default function SuperadminPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [fetchError, setFetchError] = useState('')
  const [resetState, setResetState] = useState<ResetState>({ phase: 'idle' })
  const [setupState, setSetupState] = useState<SetupState>({ phase: 'idle' })

  useEffect(() => {
    fetch('/api/superadmin/empresas')
      .then((r) => {
        if (!r.ok) throw new Error('Error al cargar empresas')
        return r.json()
      })
      .then(setEmpresas)
      .catch((e) => setFetchError(e.message))
  }, [])

  // Reset handlers
  function openConfirm(empresa: Empresa) {
    setResetState({ phase: 'confirming', empresa, typedCode: '' })
  }

  function closeConfirm() {
    setResetState({ phase: 'idle' })
  }

  async function handleReset() {
    if (resetState.phase !== 'confirming') return
    const { empresa } = resetState
    setResetState({ phase: 'loading', empresa })

    try {
      const res = await fetch('/api/superadmin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresa.id }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Error al resetear')
      } else {
        toast.success(data.message)
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setResetState({ phase: 'idle' })
    }
  }

  // Setup handlers
  function openSetup(empresa: Empresa) {
    setSetupState({ phase: 'form', empresa, form: emptyForm() })
  }

  function closeSetup() {
    setSetupState({ phase: 'idle' })
  }

  function updateSetupForm(field: keyof SetupForm, value: string) {
    setSetupState((prev) => {
      if (prev.phase !== 'form') return prev
      return { ...prev, form: { ...prev.form, [field]: value } }
    })
  }

  async function handleSetup() {
    if (setupState.phase !== 'form') return
    const { empresa, form } = setupState
    setSetupState({ phase: 'loading', empresa })

    try {
      const res = await fetch('/api/superadmin/primer-acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa_id: empresa.id,
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          nombre_sucursal: form.nombre_sucursal,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Error al configurar primer acceso')
        setSetupState({ phase: 'form', empresa, form })
      } else {
        toast.success(data.message)
        setEmpresas((prev) =>
          prev.map((e) =>
            e.id === empresa.id ? { ...e, estado_implementacion: 'activo' } : e
          )
        )
        setSetupState({ phase: 'idle' })
      }
    } catch {
      toast.error('Error de conexión')
      setSetupState({ phase: 'form', empresa, form })
    }
  }

  const isResetting = resetState.phase === 'confirming' || resetState.phase === 'loading'
  const isResetLoading = resetState.phase === 'loading'
  const resetEmpresa = resetState.phase !== 'idle' ? resetState.empresa : null
  const typedCode = resetState.phase === 'confirming' ? resetState.typedCode : ''
  const canConfirm =
    resetState.phase === 'confirming' && typedCode === resetState.empresa.codigo

  const isSetupOpen = setupState.phase === 'form' || setupState.phase === 'loading'
  const isSetupLoading = setupState.phase === 'loading'
  const setupEmpresa = setupState.phase !== 'idle' ? setupState.empresa : null
  const setupForm = setupState.phase === 'form' ? setupState.form : emptyForm()
  const canSetup =
    setupState.phase === 'form' &&
    setupState.form.nombre.trim() !== '' &&
    setupState.form.email.trim() !== '' &&
    setupState.form.password !== '' &&
    setupState.form.nombre_sucursal.trim() !== ''

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Empresas</h2>
        <p className="text-sm text-gray-400 mt-1">
          Gestioná el acceso y los datos de cada empresa.
        </p>
      </div>

      {fetchError && (
        <p className="text-sm text-red-400 mb-4">{fetchError}</p>
      )}

      {empresas.length === 0 && !fetchError && (
        <p className="text-sm text-gray-500">Cargando...</p>
      )}

      <div className="space-y-3">
        {empresas.map((emp) => (
          <div
            key={emp.id}
            className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-5 py-4"
          >
            <div>
              <p className="font-medium text-gray-100">{emp.nombre}</p>
              <p className="text-sm text-gray-400 font-mono">{emp.codigo}</p>
            </div>
            <div className="flex items-center gap-4">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  emp.activo
                    ? 'bg-green-900 text-green-300'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                {emp.activo ? 'Activa' : 'Inactiva'}
              </span>
              {emp.estado_implementacion !== 'activo' && (
                <button
                  onClick={() => openSetup(emp)}
                  className="text-sm bg-blue-900 hover:bg-blue-800 text-blue-200 px-3 py-1.5 rounded-md transition-colors"
                >
                  Primer acceso
                </button>
              )}
              <button
                onClick={() => openConfirm(emp)}
                className="text-sm bg-red-900 hover:bg-red-800 text-red-200 px-3 py-1.5 rounded-md transition-colors"
              >
                Resetear datos
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Resetear */}
      <Dialog
        open={isResetting}
        onOpenChange={(open) => { if (!open && !isResetLoading) closeConfirm() }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetear datos de {resetEmpresa?.nombre}</DialogTitle>
            <DialogDescription>
              Esta acción eliminará{' '}
              <strong>todos los datos operativos</strong> de la empresa:{' '}
              ventas, artículos, clientes, stock, caja, órdenes y más.
              <br />
              <br />
              Se conservarán: usuarios, sucursales, roles, permisos, unidades de medida y atributos.
              <br />
              <br />
              <strong>Esta operación es irreversible.</strong>
            </DialogDescription>
          </DialogHeader>

          {resetState.phase === 'confirming' && (
            <div className="mt-2">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Escribí el código de empresa para confirmar:{' '}
                <span className="font-mono font-semibold">{resetState.empresa.codigo}</span>
              </label>
              <input
                type="text"
                value={typedCode}
                onChange={(e) =>
                  setResetState({
                    phase: 'confirming',
                    empresa: resetState.empresa,
                    typedCode: e.target.value,
                  })
                }
                autoFocus
                placeholder={resetState.empresa.codigo}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
              />
            </div>
          )}

          <DialogFooter>
            <button
              onClick={closeConfirm}
              disabled={isResetLoading}
              className="text-sm px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleReset}
              disabled={!canConfirm || isResetLoading}
              className="text-sm px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isResetLoading ? 'Reseteando...' : 'Resetear'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Primer Acceso */}
      <Dialog
        open={isSetupOpen}
        onOpenChange={(open) => { if (!open && !isSetupLoading) closeSetup() }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Primer acceso — {setupEmpresa?.nombre}</DialogTitle>
            <DialogDescription>
              Creá el usuario administrador y la primera sucursal para que la empresa pueda comenzar a operar.
            </DialogDescription>
          </DialogHeader>

          {setupState.phase === 'form' && (
            <div className="space-y-3 mt-2">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Nombre del administrador
                </label>
                <input
                  type="text"
                  value={setupForm.nombre}
                  onChange={(e) => updateSetupForm('nombre', e.target.value)}
                  autoFocus
                  placeholder="Ej: Juan García"
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={setupForm.email}
                  onChange={(e) => updateSetupForm('email', e.target.value)}
                  placeholder="admin@empresa.com"
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={setupForm.password}
                  onChange={(e) => updateSetupForm('password', e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Nombre de la sucursal
                </label>
                <input
                  type="text"
                  value={setupForm.nombre_sucursal}
                  onChange={(e) => updateSetupForm('nombre_sucursal', e.target.value)}
                  placeholder="Ej: Casa Central"
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {isSetupLoading && (
            <p className="text-sm text-gray-500 mt-2">Configurando primer acceso...</p>
          )}

          <DialogFooter>
            <button
              onClick={closeSetup}
              disabled={isSetupLoading}
              className="text-sm px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSetup}
              disabled={!canSetup || isSetupLoading}
              className="text-sm px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSetupLoading ? 'Creando...' : 'Crear acceso'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
