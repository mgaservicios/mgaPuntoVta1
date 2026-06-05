'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { Sucursal } from '@/types/sucursales'

export default function SucursalesAdminPage() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSucursales = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/dashboard/admin/sucursales')
    const data = await res.json()
    setSucursales(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSucursales() }, [fetchSucursales])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Sucursales</h2>
        <Link href="/dashboard/admin/sucursales/nueva" className={buttonVariants()}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva sucursal
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : sucursales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-gray-400">No hay sucursales</TableCell>
              </TableRow>
            ) : (
              sucursales.map((s) => (
                <TableRow key={s.id} className={!s.activo ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{s.nombre}</TableCell>
                  <TableCell>{s.direccion ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={s.activo ? 'default' : 'secondary'}>
                      {s.activo ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/admin/sucursales/${s.id}`}
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
