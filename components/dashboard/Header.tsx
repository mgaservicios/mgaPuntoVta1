'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Building2 } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Sucursal } from '@/types/sucursales'

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/ventas': 'Ventas',
  '/dashboard/ventas/pos': 'Punto de Venta',
  '/dashboard/articulos': 'Artículos',
  '/dashboard/stock': 'Stock',
  '/dashboard/caja': 'Caja',
  '/dashboard/clientes': 'Clientes',
  '/dashboard/proveedores': 'Proveedores',
  '/dashboard/cobranzas': 'Cobranzas',
  '/dashboard/admin/usuarios': 'Usuarios',
  '/dashboard/admin/roles': 'Roles',
  '/dashboard/admin/permisos': 'Permisos',
  '/dashboard/notas-credito': 'Notas de crédito',
  '/dashboard/stock/ajustes': 'Ajustes de stock',
  '/dashboard/articulos/seguimiento': 'Seguimiento de artículos',
}

function getPageTitle(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname]
  for (const [route, label] of Object.entries(ROUTE_LABELS)) {
    if (pathname.startsWith(route + '/')) return label
  }
  return 'Dashboard'
}

interface DashboardHeaderProps {
  userName: string
  userRole: string
  sucursales: Sucursal[]
  activeSucursalId: number | null
  isAdmin: boolean
  verTodas: boolean
}

export default function DashboardHeader({
  userName,
  userRole,
  sucursales,
  activeSucursalId,
  isAdmin,
  verTodas,
}: DashboardHeaderProps) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  // Sincroniza la cookie con la sucursal mostrada en el header al montar
  useEffect(() => {
    if (activeSucursalId && !verTodas) {
      fetch('/api/dashboard/sucursales/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sucursal_id: activeSucursalId }),
      })
    }
  }, [activeSucursalId, verTodas])

  async function handleSucursalChange(value: string | null) {
    if (value === null) return
    await fetch('/api/dashboard/sucursales/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sucursal_id: parseInt(value, 10) }),
    })
    window.location.reload()
  }

  const selectValue = verTodas ? '0' : activeSucursalId ? String(activeSucursalId) : undefined
  const selectLabel = verTodas
    ? 'Todas las sucursales'
    : sucursales.find((s) => s.id === activeSucursalId)?.nombre ?? 'Sucursal'

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-3">
        {(sucursales.length > 0 || isAdmin) && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <Select value={selectValue} onValueChange={handleSucursalChange}>
              <SelectTrigger className="h-8 text-sm border-gray-200 bg-gray-50 w-52">
                <SelectValue placeholder="Sucursal">
                  <span className={verTodas ? 'text-indigo-600 font-medium' : ''}>
                    {selectLabel}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {isAdmin && (
                  <SelectItem value="0">
                    <span className="font-medium text-indigo-600">Todas las sucursales</span>
                  </SelectItem>
                )}
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-gray-900 leading-none">{userName}</p>
          <p className="text-xs text-gray-400 mt-0.5">{userRole}</p>
        </div>
      </div>
    </header>
  )
}
