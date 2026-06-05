'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface UsuarioRow {
  id: string
  name: string
  email: string
  role_id: number
  role_name: string
  user_sucursales: { sucursal_id: number; sucursales: { id: number; nombre: string } | { id: number; nombre: string }[] | null }[]
}

export default function UsuariosAdminPage() {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsuarios = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/dashboard/admin/usuarios')
    const data = await res.json()
    setUsuarios(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsuarios() }, [fetchUsuarios])

  function getSucNames(user_sucursales: UsuarioRow['user_sucursales']): string {
    return user_sucursales
      .flatMap((us) => {
        if (!us.sucursales) return []
        return Array.isArray(us.sucursales) ? us.sucursales.map((s) => s.nombre) : [us.sucursales.nombre]
      })
      .join(', ') || '—'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Usuarios</h2>
        <Link href="/dashboard/admin/usuarios/nuevo" className={buttonVariants()}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo usuario
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Sucursales</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : usuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-400">No hay usuarios</TableCell>
              </TableRow>
            ) : (
              usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-gray-500">{u.email}</TableCell>
                  <TableCell>{u.role_name}</TableCell>
                  <TableCell className="text-sm text-gray-500">{getSucNames(u.user_sucursales)}</TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/admin/usuarios/${u.id}`}
                      className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
