'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Building2, ShoppingCart, Glasses, ReceiptText, Wrench, Search, Package } from 'lucide-react'
import Link from 'next/link'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Sucursal } from '@/types/sucursales'
import type { LucideIcon } from 'lucide-react'

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Inicio',
  '/dashboard/ventas': 'Ventas',
  '/dashboard/ventas/pos': 'Ticket de Venta',
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
  return 'Inicio'
}

interface DashboardHeaderProps {
  userName: string
  userRole: string
  sucursales: Sucursal[]
  activeSucursalId: number | null
  isAdmin: boolean
  verTodas: boolean
  homeSucursalNombre: string | null
  empresaNombre: string
}

export default function DashboardHeader({
  userName,
  userRole,
  sucursales,
  activeSucursalId,
  isAdmin,
  verTodas,
  homeSucursalNombre,
  empresaNombre,
}: DashboardHeaderProps) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)
  const displayTitle = title === 'Inicio' ? (empresaNombre || 'Inicio') : title

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
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-base font-semibold text-gray-900 shrink-0">{displayTitle}</h1>
        {homeSucursalNombre && (
          <span className="hidden sm:inline text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200 shrink-0">
            Logueado en: <span className="font-medium text-gray-700">{homeSucursalNombre}</span>
          </span>
        )}
      </div>

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

type QuickAction = { href: string; label: string; Icon: LucideIcon; module?: string; permKey?: string }

const QUICK_ACTIONS: QuickAction[] = [
  { href: '/dashboard/ventas/pos',               label: 'Ticket de Venta',  Icon: ShoppingCart, module: 'ventas',     permKey: 'ventas.pos.cobrar'       },
  { href: '/dashboard/optica/ordenes/nueva',     label: 'Nueva OT',         Icon: Glasses,      module: 'optica',     permKey: 'optica.ordenes.ver'      },
  { href: '/dashboard/inventario/remitos/nuevo', label: 'Nuevo remito',     Icon: ReceiptText,  module: 'inventario', permKey: 'inventario.remitos.ver'  },
  { href: '/dashboard/optica/servicios/nueva',   label: 'Nuevo servicio',   Icon: Wrench,       module: 'optica',     permKey: 'optica.servicios.ver'    },
  { href: '/dashboard/consultas/stock',          label: 'Stock y precios',  Icon: Search,       module: 'inventario', permKey: 'consultas.stock.ver'     },
  { href: '/dashboard/inventario/articulos',     label: 'Artículos',        Icon: Package,      module: 'inventario', permKey: 'inventario.articulos.ver'},
]

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function QuickActionsBar({
  modules,
  color,
  userPermissions,
}: {
  modules: string[]
  color?: string | null
  userPermissions: Record<string, boolean> | null
}) {
  const pathname = usePathname()
  const visible = QUICK_ACTIONS.filter(a => {
    if (a.module && !modules.includes(a.module)) return false
    if (!a.permKey || userPermissions === null) return true
    return userPermissions[a.permKey] === true
  })

  if (visible.length === 0) return null

  const brand = /^#[0-9A-Fa-f]{6}$/.test(color ?? '') ? color! : null

  return (
    <div className="bg-white border-b border-gray-100 flex items-center gap-1 px-4 py-2 overflow-x-auto flex-shrink-0">
      <span className="text-xs font-medium text-gray-400 mr-2 shrink-0">Acciones:</span>
      {visible.map(({ href, label, Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors"
            style={isActive
              ? { backgroundColor: brand ? hexToRgba(brand, 0.1) : undefined, color: brand ?? undefined }
              : undefined
            }
          >
            <Icon className="w-4 h-4" style={isActive ? undefined : { color: 'inherit' }} />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
