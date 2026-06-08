'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  FileText,
  Package,
  BarChart3,
  SlidersHorizontal,
  Wallet,
  Users,
  Truck,
  DollarSign,
  Settings,
  Shield,
  Lock,
  LogOut,
  Building2,
  ReceiptText,
  ChevronDown,
  Star,
  Activity,
  Search,
  Eye,
  Glasses,
  Stethoscope,
  Wrench,
  BookOpen,
  Tag,
  FolderOpen,
  Layers,
  History,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  userName: string
  userRole: string
  userModules: string[]
  userPermissions: Record<string, boolean> | null
}

type NavItem = { label: string; href: string; Icon: LucideIcon; newTab?: boolean; permKey?: string }
type NavGroup = {
  id: string
  label: string
  Icon: LucideIcon
  module?: string
  roles?: string[]
  items: NavItem[]
}

const FAVORITES: NavItem[] = [
  { label: 'POS',            href: '/dashboard/ventas/pos',               Icon: ShoppingCart, permKey: 'ventas.pos.cobrar' },
  { label: 'Caja',           href: '/dashboard/caja',                     Icon: Wallet,       permKey: 'caja.caja.ver' },
  { label: 'Orden Trabajo',  href: '/dashboard/optica/ordenes',           Icon: Glasses,      permKey: 'optica.ordenes.ver' },
  { label: 'Remito',         href: '/dashboard/inventario/remitos',       Icon: ReceiptText,  permKey: 'inventario.remitos.ver' },
]

const navGroups: NavGroup[] = [
  {
    id: 'ventas',
    label: 'Ventas',
    Icon: ShoppingCart,
    module: 'ventas',
    items: [
      { label: 'Punto de Venta',   href: '/dashboard/ventas/pos',           Icon: ShoppingCart,  permKey: 'ventas.pos.cobrar' },
      { label: 'Órdenes de venta', href: '/dashboard/ventas/ordenes',       Icon: FileText,      permKey: 'ventas.ordenes.ver' },
      { label: 'Historial',        href: '/dashboard/ventas',               Icon: ClipboardList, permKey: 'ventas.historial.ver' },
      { label: 'Clientes',         href: '/dashboard/ventas/clientes',      Icon: Users,         permKey: 'ventas.clientes.ver' },
      { label: 'Notas de crédito', href: '/dashboard/ventas/notas-credito', Icon: ReceiptText,   permKey: 'ventas.notas-credito.ver' },
    ],
  },
  {
    id: 'inventario',
    label: 'Inventario',
    Icon: Package,
    module: 'inventario',
    items: [
      { label: 'Artículos',        href: '/dashboard/inventario/articulos',         Icon: Package,           permKey: 'inventario.articulos.ver' },
      { label: 'Remitos',          href: '/dashboard/inventario/remitos',           Icon: BarChart3,         permKey: 'inventario.remitos.ver' },
      { label: 'Proveedores',      href: '/dashboard/inventario/proveedores',       Icon: Truck,             permKey: 'inventario.proveedores.ver' },
      { label: 'Ajustes de stock', href: '/dashboard/inventario/remitos/ajustes',  Icon: SlidersHorizontal, permKey: 'inventario.ajustes.ver' },
    ],
  },
  {
    id: 'altas',
    label: 'Altas',
    Icon: Tag,
    module: 'inventario',
    items: [
      { label: 'Marcas',        href: '/dashboard/altas/marcas',        Icon: Tag,              permKey: 'altas.marcas.ver' },
      { label: 'Categorías',    href: '/dashboard/altas/categorias',    Icon: FolderOpen,       permKey: 'altas.categorias.ver' },
      { label: 'Subcategorías', href: '/dashboard/altas/subcategorias', Icon: Layers,           permKey: 'altas.subcategorias.ver' },
      { label: 'Atributos',     href: '/dashboard/altas/atributos',     Icon: SlidersHorizontal, permKey: 'altas.atributos.ver' },
    ],
  },
  {
    id: 'consultas',
    label: 'Consultas',
    Icon: BookOpen,
    module: 'inventario',
    items: [
      { label: 'Stock y precios',    href: '/dashboard/consultas/stock',          Icon: Search,      permKey: 'consultas.stock.ver' },
      { label: 'Seguimiento',        href: '/dashboard/consultas/seguimiento',    Icon: Activity,    permKey: 'consultas.seguimiento.ver' },
      { label: 'Precios de costo',   href: '/dashboard/consultas/precios-costo',  Icon: DollarSign,  permKey: 'consultas.precios_costo.ver' },
    ],
  },
  {
    id: 'caja',
    label: 'Caja',
    Icon: Wallet,
    module: 'caja',
    items: [
      { label: 'Caja',      href: '/dashboard/caja',           Icon: Wallet,     permKey: 'caja.caja.ver' },
      { label: 'Historial', href: '/dashboard/caja/historial',  Icon: History,    permKey: 'caja.caja.ver' },
      { label: 'Cobranzas', href: '/dashboard/cobranzas',       Icon: DollarSign, permKey: 'caja.cobranzas.ver' },
    ],
  },
  {
    id: 'listados',
    label: 'Listados',
    Icon: BarChart3,
    items: [
      { label: 'Cobranzas',          href: '/dashboard/listados/cobranzas',        Icon: DollarSign, permKey: 'listados.cobranzas.ver' },
      { label: 'Venta de artículos', href: '/dashboard/listados/ventas-articulos', Icon: Package,    permKey: 'listados.ventas_articulos.ver' },
      { label: 'Lista de precios',   href: '/dashboard/listados/precios',          Icon: Tag,        permKey: 'listados.precios.ver' },
    ],
  },
  {
    id: 'optica',
    label: 'Óptica',
    Icon: Eye,
    module: 'optica',
    items: [
      { label: 'Órdenes de trabajo', href: '/dashboard/optica/ordenes',   Icon: ClipboardList, permKey: 'optica.ordenes.ver' },
      { label: 'Servicios',          href: '/dashboard/optica/servicios', Icon: Wrench,        permKey: 'optica.servicios.ver' },
      { label: 'Médicos',            href: '/dashboard/optica/medicos',   Icon: Stethoscope,   permKey: 'optica.medicos.ver' },
    ],
  },
  {
    id: 'admin',
    label: 'Administración',
    Icon: Settings,
    items: [
      { label: 'Sucursales',      href: '/dashboard/admin/sucursales',   Icon: Building2, permKey: 'admin.sucursales.ver' },
      { label: 'Usuarios',        href: '/dashboard/admin/usuarios',     Icon: Settings,  permKey: 'admin.usuarios.ver' },
      { label: 'Roles',           href: '/dashboard/admin/roles',        Icon: Shield,    permKey: 'admin.roles.ver' },
      { label: 'Permisos',        href: '/dashboard/admin/permisos',     Icon: Lock,      permKey: 'admin.permisos.ver' },
      { label: 'Listas de precio', href: '/dashboard/admin/listas-precio', Icon: Tag,    permKey: 'admin.listas_precio.ver' },
    ],
  },
]

export default function Sidebar({ userName, userRole, userModules, userPermissions }: SidebarProps) {
  const pathname = usePathname()

  // null = admin (all visible), Record = filter by can_view
  function canView(permKey?: string): boolean {
    if (!permKey || userPermissions === null) return true
    return userPermissions[permKey] === true
  }

  const visibleGroups = navGroups
    .filter(
      (g) =>
        (!g.module || userModules.includes(g.module)) &&
        (!g.roles || g.roles.includes(userRole))
    )
    .map((g) => ({ ...g, items: g.items.filter((item) => canView(item.permKey)) }))
    .filter((g) => g.items.length > 0)

  const allHrefs = visibleGroups.flatMap(g => g.items.map(i => i.href))

  const isItemActive = (href: string) =>
    pathname === href ||
    (pathname.startsWith(href + '/') &&
      !allHrefs.some(h => h !== href && pathname.startsWith(h)))

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const open = new Set<string>()
    for (const group of visibleGroups) {
      if (group.items.some(item => isItemActive(item.href))) {
        open.add(group.id)
        break
      }
    }
    return open
  })

  useEffect(() => {
    for (const group of visibleGroups) {
      if (group.items.some(item => isItemActive(item.href))) {
        setOpenGroups(prev => {
          if (prev.has(group.id)) return prev
          return new Set([...prev, group.id])
        })
        break
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col bg-[#0D1525]">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-center">
        <Image
          src="/logos/logo blanco.png"
          alt="MGA Informática"
          width={140}
          height={56}
          className="object-contain"
          priority
        />
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {/* Dashboard */}
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            pathname === '/dashboard'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-white/60 hover:bg-white/8 hover:text-white'
          )}
        >
          <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
          Dashboard
        </Link>

        {/* Favoritos */}
        <div className="mt-4 mb-1">
          <p className="px-2 mb-2 text-[10px] font-semibold text-white/35 uppercase tracking-widest flex items-center gap-1.5">
            <Star className="w-3 h-3" />
            Favoritos
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {FAVORITES.filter((fav) => canView(fav.permKey)).map((fav) => (
              <Link
                key={fav.href}
                href={fav.href}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-lg bg-white/5 hover:bg-blue-600 text-white/55 hover:text-white transition-colors"
              >
                <fav.Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-[10px] font-medium text-center leading-tight">{fav.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-white/8 my-3" />

        {/* Módulos colapsables */}
        <div className="space-y-0.5">
          {visibleGroups.map((group) => {
            const isOpen = openGroups.has(group.id)
            const hasActiveItem = group.items.some(item => isItemActive(item.href))

            return (
              <div key={group.id}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium transition-colors',
                    hasActiveItem
                      ? 'text-white/90 hover:bg-white/8'
                      : 'text-white/55 hover:bg-white/8 hover:text-white/85'
                  )}
                >
                  <group.Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 text-white/30 transition-transform duration-200',
                      isOpen && 'rotate-180'
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="ml-3 pl-3.5 border-l border-white/10 mt-0.5 mb-1 space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = isItemActive(item.href)
                      const cls = cn(
                        'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-white/55 hover:bg-white/8 hover:text-white'
                      )
                      return item.newTab ? (
                        <a
                          key={item.href}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cls}
                        >
                          <item.Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          {item.label}
                        </a>
                      ) : (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cls}
                        >
                          <item.Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Usuario */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-xs font-medium truncate">{userName}</p>
            <p className="text-white/40 text-xs truncate">{userRole}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-white/50 hover:bg-white/8 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
