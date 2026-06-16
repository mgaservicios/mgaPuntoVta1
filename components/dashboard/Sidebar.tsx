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
  FileUp,
  UserCheck,
  CreditCard,
  TrendingUp,
  Download,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface SidebarProps {
  userName: string
  userRole: string
  userModules: string[]
  userPermissions: Record<string, boolean> | null
  logoUrl: string | null
  color: string | null
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


const navGroups: NavGroup[] = [
  {
    id: 'ventas',
    label: 'Ventas',
    Icon: ShoppingCart,
    module: 'ventas',
    items: [
      { label: 'Ticket de Venta',   href: '/dashboard/ventas/pos',           Icon: ShoppingCart,  permKey: 'ventas.pos.cobrar' },
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
      { label: 'Ajustes de stock',     href: '/dashboard/inventario/remitos/ajustes',      Icon: SlidersHorizontal, permKey: 'inventario.ajustes.ver' },
      { label: 'Actualizar precios',   href: '/dashboard/inventario/actualizar-precios',  Icon: TrendingUp,        permKey: 'inventario.articulos.ver' },
      { label: 'Importar artículos',    href: '/dashboard/inventario/importar-articulos',   Icon: FileUp,            permKey: 'inventario.articulos.crear' },
      { label: 'Importar stock',       href: '/dashboard/inventario/importar-stock',       Icon: FileUp,            permKey: 'inventario.articulos.crear' },
    ],
  },
  {
    id: 'altas',
    label: 'Altas',
    Icon: Tag,
    module: 'altas',
    items: [
      { label: 'Marcas',           href: '/dashboard/altas/marcas',           Icon: Tag,               permKey: 'altas.marcas.ver'        },
      { label: 'Categorías',     href: '/dashboard/altas/categorias',     Icon: FolderOpen,        permKey: 'altas.categorias.ver'    },
      { label: 'Subcategorías',  href: '/dashboard/altas/subcategorias',  Icon: Layers,            permKey: 'altas.subcategorias.ver' },
      { label: 'Atributos',      href: '/dashboard/altas/atributos',      Icon: SlidersHorizontal, permKey: 'altas.atributos.ver'     },
      { label: 'Listas de precio', href: '/dashboard/admin/listas-precio', Icon: Tag,             permKey: 'altas.listas_precio.ver' },
      { label: 'Vendedores',     href: '/dashboard/admin/vendedores',     Icon: UserCheck,         permKey: 'altas.vendedores.ver'    },
      { label: 'Formas de pago', href: '/dashboard/admin/formas-pago',   Icon: CreditCard,        permKey: 'altas.formas_pago.ver'   },
    ],
  },
  {
    id: 'consultas',
    label: 'Consultas',
    Icon: BookOpen,
    module: 'consultas',
    items: [
      { label: 'Stock y precios',    href: '/dashboard/consultas/stock',          Icon: Search,      permKey: 'consultas.stock.ver' },
      { label: 'Seguimiento',        href: '/dashboard/consultas/seguimiento',    Icon: Activity,    permKey: 'consultas.seguimiento.ver' },
      { label: 'Precios de costo',   href: '/dashboard/consultas/precios-costo',  Icon: DollarSign,  permKey: 'consultas.precios_costo.ver' },
    ],
  },
  {
    id: 'fondos',
    label: 'Fondos',
    Icon: Wallet,
    module: 'fondos',
    items: [
      { label: 'Caja',               href: '/dashboard/fondos',           Icon: Wallet,      permKey: 'fondos.caja.ver' },
      { label: 'Historial de cierres', href: '/dashboard/fondos/historial', Icon: History,   permKey: 'fondos.caja.ver' },
      { label: 'Cobranzas',          href: '/dashboard/fondos/cobranzas', Icon: DollarSign,  permKey: 'fondos.cobranzas.ver' },
      { label: 'Recibos',            href: '/dashboard/fondos/recibos',   Icon: ReceiptText, permKey: 'fondos.recibos.ver' },
    ],
  },
  {
    id: 'listados',
    label: 'Listados',
    Icon: BarChart3,
    module: 'listados',
    items: [
      { label: 'Cta. Cte. Clientes', href: '/dashboard/listados/cobranzas',        Icon: DollarSign, permKey: 'listados.cobranzas.ver' },
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
      { label: 'Órdenes de trabajo', href: '/dashboard/optica/ordenes',              Icon: ClipboardList, permKey: 'optica.ordenes.ver' },
      { label: 'Servicios',          href: '/dashboard/optica/servicios',            Icon: Wrench,        permKey: 'optica.servicios.ver' },
      { label: 'Médicos',            href: '/dashboard/optica/medicos',              Icon: Stethoscope,   permKey: 'optica.medicos.ver' },
      { label: 'Importar óptica',    href: '/dashboard/inventario/importar-optica', Icon: FileUp,        permKey: 'optica.ordenes.ver' },
    ],
  },
  {
    id: 'admin',
    label: 'Administración',
    Icon: Settings,
    module: 'administracion',
    items: [
      { label: 'Sucursales',      href: '/dashboard/admin/sucursales',   Icon: Building2, permKey: 'admin.sucursales.ver' },
      { label: 'Usuarios',        href: '/dashboard/admin/usuarios',     Icon: Settings,  permKey: 'admin.usuarios.ver' },
      { label: 'Roles',           href: '/dashboard/admin/roles',        Icon: Shield,    permKey: 'admin.roles.ver' },
      { label: 'Permisos',        href: '/dashboard/admin/permisos',     Icon: Lock,      permKey: 'admin.permisos.ver' },
      { label: 'Parámetros',        href: '/dashboard/admin/parametros',    Icon: SlidersHorizontal, permKey: 'admin.parametros.ver'   },
    ],
  },
]

export default function Sidebar({ userName, userRole, userModules, userPermissions, logoUrl, color }: SidebarProps) {
  const pathname = usePathname()
  const [backupConfirmOpen, setBackupConfirmOpen] = useState(false)
  const [backupInProgress, setBackupInProgress] = useState(false)

  async function handleBackupConfirm() {
    setBackupConfirmOpen(false)
    setBackupInProgress(true)
    try {
      const res = await fetch('/api/dashboard/backup')
      if (!res.ok) {
        toast.error('Error al generar el backup')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Backup descargado correctamente')
    } catch {
      toast.error('Error al generar el backup')
    } finally {
      setBackupInProgress(false)
    }
  }

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
    <aside
      className="w-60 flex-shrink-0 flex flex-col"
      style={{ backgroundColor: color || '#0D1525' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10 flex flex-col items-center gap-3">
        {logoUrl ? (
          <div className="w-24 h-24 rounded-full bg-white shadow-sm flex items-center justify-center overflow-hidden p-2">
            <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <Image
            src="/logos/logo blanco.png"
            alt="MGA Informática"
            width={190}
            height={76}
            className="object-contain"
            priority
          />
        )}
        {userRole === 'Administrador' && (
          <button
            onClick={() => setBackupConfirmOpen(true)}
            disabled={backupInProgress}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white/70 border border-white/15 hover:bg-white/10 hover:text-white hover:border-white/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            Descargar backup
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {/* Dashboard */}
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-base font-bold transition-colors',
            pathname === '/dashboard'
              ? 'bg-white/20 text-white shadow-sm'
              : 'text-white/60 hover:bg-white/8 hover:text-white'
          )}
        >
          <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
          Inicio
        </Link>

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
                    'flex items-center gap-3 px-3 py-2 w-full rounded-lg transition-colors',
                    hasActiveItem
                      ? 'text-white hover:bg-white/8'
                      : 'text-white/70 hover:bg-white/8 hover:text-white'
                  )}
                >
                  <group.Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left text-sm font-bold uppercase tracking-wide">{group.label}</span>
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
                          ? 'bg-white/20 text-white shadow-sm'
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

      {/* Dialog de confirmación */}
      <Dialog open={backupConfirmOpen} onOpenChange={setBackupConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Backup completo del sistema</DialogTitle>
            <DialogDescription>
              Se va a exportar toda la base de datos a un archivo Excel con una hoja por cada tabla.
              Este proceso puede demorar unos segundos dependiendo de la cantidad de datos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBackupConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBackupConfirm}>
              <Download className="w-4 h-4" />
              Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de progreso — bloquea toda la pantalla, no se puede cerrar */}
      <Dialog open={backupInProgress} onOpenChange={() => {}}>
        <DialogContent showCloseButton={false} className="max-w-sm text-center">
          <style>{`
            @keyframes bar-slide {
              0%   { transform: translateX(-100%); }
              60%  { transform: translateX(250%); }
              100% { transform: translateX(250%); }
            }
          `}</style>

          <div className="flex flex-col items-center gap-5 py-2">
            {/* Spinner */}
            <div className="w-16 h-16 rounded-full border-4 border-blue-100 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>

            {/* Texto principal */}
            <div className="space-y-1">
              <p className="font-semibold text-gray-800">Generando backup…</p>
              <p className="text-sm text-gray-500">Exportando todos los datos del sistema</p>
            </div>

            {/* Barra de progreso indeterminada */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full w-2/5 bg-blue-600 rounded-full"
                style={{ animation: 'bar-slide 1.6s ease-in-out infinite' }}
              />
            </div>

            {/* Aviso bloqueante */}
            <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 space-y-1 w-full">
              <p className="font-bold text-amber-800 text-sm tracking-wide">
                ⚠ NO CERRAR VENTANA
              </p>
              <p className="text-xs text-amber-700 leading-snug">
                AGUARDE A QUE SE TERMINE EL BACKUP PARA CERRAR. GRACIAS!
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
