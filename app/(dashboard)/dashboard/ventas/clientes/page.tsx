'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Pencil, PowerOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import type { Cliente } from '@/types/clientes'

const TIPO_LABEL: Record<string, string> = {
  PARTICULAR: 'Particular',
  EMPRESA: 'Empresa',
  COMERCIO: 'Comercio',
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [desactivando, setDesactivando] = useState(false)

  const fetchClientes = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ activo: 'false' })
    if (q) params.set('q', q)
    const res = await fetch(`/api/dashboard/clientes?${params}`)
    const data = await res.json()
    setClientes(data)
    setLoading(false)
  }, [q])

  useEffect(() => {
    const t = setTimeout(fetchClientes, 300)
    return () => clearTimeout(t)
  }, [fetchClientes])

  async function handleDesactivar() {
    if (!confirmId) return
    setDesactivando(true)
    const res = await fetch(`/api/dashboard/clientes/${confirmId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Cliente desactivado')
      setClientes((prev) => prev.map((c) => c.id === confirmId ? { ...c, activo: false } : c))
    } else {
      toast.error('Error al desactivar')
    }
    setDesactivando(false)
    setConfirmId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar cliente..."
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Link href="/dashboard/ventas/clientes/nuevo" className={buttonVariants()}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo cliente
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : clientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                  No hay clientes
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((c) => (
                <TableRow key={c.id} className={!c.activo ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell>{TIPO_LABEL[c.tipo] ?? c.tipo}</TableCell>
                  <TableCell>{c.telefono ?? '—'}</TableCell>
                  <TableCell>{c.email ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={c.activo ? 'default' : 'secondary'}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Link
                        href={`/dashboard/ventas/clientes/${c.id}`}
                        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      {c.activo && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setConfirmId(c.id)}
                        >
                          <PowerOff className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="Desactivar cliente"
        description="El cliente quedará inactivo. Podés reactivarlo editándolo."
        confirmLabel="Desactivar"
        loading={desactivando}
        onConfirm={handleDesactivar}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
