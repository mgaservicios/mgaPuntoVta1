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
}

type ResetState =
  | { phase: 'idle' }
  | { phase: 'confirming'; empresa: Empresa; typedCode: string }
  | { phase: 'loading'; empresa: Empresa }

export default function SuperadminPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [fetchError, setFetchError] = useState('')
  const [state, setState] = useState<ResetState>({ phase: 'idle' })

  useEffect(() => {
    fetch('/api/superadmin/empresas')
      .then((r) => {
        if (!r.ok) throw new Error('Error al cargar empresas')
        return r.json()
      })
      .then(setEmpresas)
      .catch((e) => setFetchError(e.message))
  }, [])

  function openConfirm(empresa: Empresa) {
    setState({ phase: 'confirming', empresa, typedCode: '' })
  }

  function closeConfirm() {
    setState({ phase: 'idle' })
  }

  async function handleReset() {
    if (state.phase !== 'confirming') return
    const { empresa } = state
    setState({ phase: 'loading', empresa })

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
      setState({ phase: 'idle' })
    }
  }

  const isConfirming = state.phase === 'confirming'
  const isLoading = state.phase === 'loading'
  const dialogOpen = isConfirming || isLoading
  const currentEmpresa = state.phase !== 'idle' ? state.empresa : null
  const typedCode = isConfirming ? state.typedCode : ''
  const canConfirm = isConfirming && typedCode === state.empresa.codigo

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Empresas</h2>
        <p className="text-sm text-gray-400 mt-1">
          Seleccioná una empresa para resetear sus datos operativos.
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

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !isLoading) closeConfirm() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetear datos de {currentEmpresa?.nombre}</DialogTitle>
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

          {isConfirming && (
            <div className="mt-2">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Escribí el código de empresa para confirmar:{' '}
                <span className="font-mono font-semibold">{state.empresa.codigo}</span>
              </label>
              <input
                type="text"
                value={typedCode}
                onChange={(e) =>
                  setState({ phase: 'confirming', empresa: state.empresa, typedCode: e.target.value })
                }
                autoFocus
                placeholder={state.empresa.codigo}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
              />
            </div>
          )}

          <DialogFooter>
            <button
              onClick={closeConfirm}
              disabled={isLoading}
              className="text-sm px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleReset}
              disabled={!canConfirm || isLoading}
              className="text-sm px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Reseteando...' : 'Resetear'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
