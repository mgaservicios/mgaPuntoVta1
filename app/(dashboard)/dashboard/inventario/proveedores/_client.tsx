'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Pencil, PowerOff, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { usePermissions } from '@/components/PermissionsProvider'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import type { Proveedor } from '@/types/proveedores'

export default function ProveedoresClient({ isAdmin }: { isAdmin: boolean }) {
  const { can } = usePermissions()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [desactivando, setDesactivando] = useState(false)

  const fetchProveedores = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ activo: 'false' })
    if (q) params.set('q', q)
    const res = await fetch(`/api/dashboard/proveedores?${params}`)
    const data = await res.json()
    setProveedores(data)
    setLoading(false)
  }, [q])

  useEffect(() => {
    const t = setTimeout(fetchProveedores, 300)
    return () => clearTimeout(t)
  }, [fetchProveedores])

  async function handleDesactivar() {
    if (!confirmId) return
    setDesactivando(true)
    const res = await fetch(`/api/dashboard/proveedores/${confirmId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Proveedor desactivado')
      setProveedores((prev) => prev.map((p) => p.id === confirmId ? { ...p, activo: false } : p))
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
            placeholder="Buscar proveedor..."
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link href="/dashboard/inventario/importar-proveedores" className={buttonVariants({ variant: 'outline' })}>
              <Upload className="w-4 h-4 mr-2" />
              Importar CSV
            </Link>
          )}
          {can('inventario.proveedores.crear') && (
            <Link href="/dashboard/inventario/proveedores/nuevo" className={buttonVariants()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo proveedor
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>CUIT</TableHead>
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
            ) : proveedores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                  No hay proveedores
                </TableCell>
              </TableRow>
            ) : (
              proveedores.map((p) => (
                <TableRow key={p.id} className={!p.activo ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>{p.cuit ?? '—'}</TableCell>
                  <TableCell>{p.telefono ?? '—'}</TableCell>
                  <TableCell>{p.email ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={p.activo ? 'default' : 'secondary'}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      {can('inventario.proveedores.editar') && (
                        <Link
                          href={`/dashboard/inventario/proveedores/${p.id}`}
                          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                      )}
                      {p.activo && can('inventario.proveedores.desactivar') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setConfirmId(p.id)}
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
        title="Desactivar proveedor"
        description="El proveedor quedará inactivo. Podés reactivarlo editándolo."
        confirmLabel="Desactivar"
        loading={desactivando}
        onConfirm={handleDesactivar}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
