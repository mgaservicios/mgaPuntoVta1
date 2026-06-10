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

interface Vendedor {
  id: number
  nombre: string
  sucursal_id: number
  activo: boolean
  sucursales: { nombre: string } | null
}

export default function VendedoresAdminPage() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)

  const fetchVendedores = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/dashboard/admin/vendedores')
    const data = await res.json()
    setVendedores(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchVendedores() }, [fetchVendedores])

  async function handleDelete(id: number, nombre: string) {
    if (!confirm(`¿Eliminar vendedor "${nombre}"?`)) return
    const res = await fetch(`/api/dashboard/admin/vendedores/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Vendedor eliminado')
      fetchVendedores()
    } else {
      const data = await res.json()
      toast.error(data.error ?? 'Error al eliminar')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Vendedores</h2>
        <Link href="/dashboard/admin/vendedores/nuevo" className={buttonVariants()}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo vendedor
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : vendedores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-400">No hay vendedores</TableCell>
              </TableRow>
            ) : (
              vendedores.map((v) => (
                <TableRow key={v.id} className={!v.activo ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{v.nombre}</TableCell>
                  <TableCell>{v.sucursales?.nombre ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={v.activo ? 'default' : 'secondary'}>
                      {v.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/dashboard/admin/vendedores/${v.id}`}
                        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(v.id, v.nombre)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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
