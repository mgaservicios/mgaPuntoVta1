'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import type { Role } from '@/types/auth'

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/dashboard/admin/roles')
    const data = await res.json()
    setRoles(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  async function handleDelete() {
    if (!confirmId) return
    setDeleting(true)
    const res = await fetch(`/api/dashboard/admin/roles/${confirmId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Rol eliminado')
      setRoles((prev) => prev.filter((r) => r.id !== confirmId))
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al eliminar')
    }
    setDeleting(false)
    setConfirmId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Roles</h2>
        <Link href="/dashboard/admin/roles/nuevo" className={buttonVariants()}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo rol
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Por defecto</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-400">No hay roles</TableCell>
              </TableRow>
            ) : (
              roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-gray-500">{r.description ?? '—'}</TableCell>
                  <TableCell>
                    {r.is_default && <Badge variant="secondary">Predeterminado</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Link
                        href={`/dashboard/admin/roles/${r.id}`}
                        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      {!r.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => setConfirmId(r.id)}
                        >
                          <Trash2 className="w-4 h-4" />
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
        title="Eliminar rol"
        description="Esta acción es permanente. No se puede eliminar un rol con usuarios asignados."
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
