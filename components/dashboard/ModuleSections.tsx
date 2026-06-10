'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ShoppingCart, ReceiptText, Wrench,
  Search, Package, Wallet, type LucideIcon,
  FileText, ClipboardList, Users, BarChart3, Truck,
  SlidersHorizontal, Tag, FolderOpen, Layers,
  Activity, DollarSign, History, Stethoscope, FileUp,
  Settings, Building2, Shield, Lock, UserCheck, CreditCard,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type CardColor = 'blue' | 'indigo' | 'teal' | 'violet' | 'orange' | 'emerald' | 'amber' | 'rose' | 'slate'

const CARD_COLORS: Record<CardColor, {
  // module header card (solid bg)
  headerBg: string; headerHover: string; headerOpenBg: string
  // item card (white bg + accent)
  itemIconBg: string; itemIcon: string; itemBorder: string
}> = {
  blue:    { headerBg: 'bg-blue-600',    headerHover: 'hover:bg-blue-700',    headerOpenBg: 'bg-blue-700',    itemIconBg: 'bg-blue-50',    itemIcon: 'text-blue-600',    itemBorder: 'hover:border-blue-300' },
  indigo:  { headerBg: 'bg-indigo-600',  headerHover: 'hover:bg-indigo-700',  headerOpenBg: 'bg-indigo-700',  itemIconBg: 'bg-indigo-50',  itemIcon: 'text-indigo-600',  itemBorder: 'hover:border-indigo-300' },
  teal:    { headerBg: 'bg-teal-600',    headerHover: 'hover:bg-teal-700',    headerOpenBg: 'bg-teal-700',    itemIconBg: 'bg-teal-50',    itemIcon: 'text-teal-600',    itemBorder: 'hover:border-teal-300' },
  violet:  { headerBg: 'bg-violet-600',  headerHover: 'hover:bg-violet-700',  headerOpenBg: 'bg-violet-700',  itemIconBg: 'bg-violet-50',  itemIcon: 'text-violet-600',  itemBorder: 'hover:border-violet-300' },
  orange:  { headerBg: 'bg-orange-500',  headerHover: 'hover:bg-orange-600',  headerOpenBg: 'bg-orange-600',  itemIconBg: 'bg-orange-50',  itemIcon: 'text-orange-600',  itemBorder: 'hover:border-orange-300' },
  emerald: { headerBg: 'bg-emerald-600', headerHover: 'hover:bg-emerald-700', headerOpenBg: 'bg-emerald-700', itemIconBg: 'bg-emerald-50', itemIcon: 'text-emerald-600', itemBorder: 'hover:border-emerald-300' },
  amber:   { headerBg: 'bg-amber-500',   headerHover: 'hover:bg-amber-600',   headerOpenBg: 'bg-amber-600',   itemIconBg: 'bg-amber-50',   itemIcon: 'text-amber-600',   itemBorder: 'hover:border-amber-300' },
  rose:    { headerBg: 'bg-rose-600',    headerHover: 'hover:bg-rose-700',    headerOpenBg: 'bg-rose-700',    itemIconBg: 'bg-rose-50',    itemIcon: 'text-rose-600',    itemBorder: 'hover:border-rose-300' },
  slate:   { headerBg: 'bg-slate-600',   headerHover: 'hover:bg-slate-700',   headerOpenBg: 'bg-slate-700',   itemIconBg: 'bg-slate-100',  itemIcon: 'text-slate-600',   itemBorder: 'hover:border-slate-300' },
}

type ModuleSection = {
  id: string
  label: string
  module?: string
  headerIcon: LucideIcon
  color: CardColor
  items: Array<{ label: string; href: string; Icon: LucideIcon; description: string }>
}

const MODULE_SECTIONS: ModuleSection[] = [
  {
    id: 'ventas',
    label: 'Ventas',
    module: 'ventas',
    headerIcon: ShoppingCart,
    color: 'blue',
    items: [
      { label: 'Ticket de Venta',   href: '/dashboard/ventas/pos',            Icon: ShoppingCart,  description: 'Cobros y tickets'          },
      { label: 'Órdenes de venta', href: '/dashboard/ventas/ordenes',        Icon: FileText,      description: 'Presupuestos y pedidos'    },
      { label: 'Historial',        href: '/dashboard/ventas',                Icon: ClipboardList, description: 'Ventas realizadas'         },
      { label: 'Clientes',         href: '/dashboard/ventas/clientes',       Icon: Users,         description: 'Empresas y particulares'   },
      { label: 'Notas de crédito', href: '/dashboard/ventas/notas-credito',  Icon: ReceiptText,   description: 'Devoluciones y ajustes'    },
    ],
  },
  {
    id: 'inventario',
    label: 'Inventario',
    module: 'inventario',
    headerIcon: Package,
    color: 'emerald',
    items: [
      { label: 'Artículos',        href: '/dashboard/inventario/articulos',         Icon: Package,           description: 'Catálogo y precios'    },
      { label: 'Remitos',          href: '/dashboard/inventario/remitos',           Icon: BarChart3,         description: 'Entradas y salidas'    },
      { label: 'Proveedores',      href: '/dashboard/inventario/proveedores',       Icon: Truck,             description: 'Contactos de compras'  },
      { label: 'Ajustes de stock', href: '/dashboard/inventario/remitos/ajustes',  Icon: SlidersHorizontal, description: 'Correcciones manuales' },
    ],
  },
  {
    id: 'altas',
    label: 'Altas',
    module: 'inventario',
    headerIcon: Tag,
    color: 'orange',
    items: [
      { label: 'Marcas',        href: '/dashboard/altas/marcas',        Icon: Tag,               description: 'Marcas de productos'      },
      { label: 'Categorías',    href: '/dashboard/altas/categorias',    Icon: FolderOpen,        description: 'Grupos de artículos'      },
      { label: 'Subcategorías', href: '/dashboard/altas/subcategorias', Icon: Layers,            description: 'Subgrupos de artículos'   },
      { label: 'Atributos',     href: '/dashboard/altas/atributos',     Icon: SlidersHorizontal, description: 'Propiedades de artículos' },
    ],
  },
  {
    id: 'consultas',
    label: 'Consultas',
    module: 'inventario',
    headerIcon: Search,
    color: 'violet',
    items: [
      { label: 'Stock y precios',  href: '/dashboard/consultas/stock',         Icon: Search,     description: 'Disponibilidad y precios' },
      { label: 'Seguimiento',      href: '/dashboard/consultas/seguimiento',   Icon: Activity,   description: 'Estado de órdenes'        },
      { label: 'Precios de costo', href: '/dashboard/consultas/precios-costo', Icon: DollarSign, description: 'Costos y márgenes'        },
    ],
  },
  {
    id: 'fondos',
    label: 'Fondos',
    module: 'caja',
    headerIcon: Wallet,
    color: 'amber',
    items: [
      { label: 'Caja',      href: '/dashboard/caja',           Icon: Wallet,      description: 'Sesión activa de caja'     },
      { label: 'Historial', href: '/dashboard/caja/historial', Icon: History,     description: 'Movimientos anteriores'    },
      { label: 'Cobranzas', href: '/dashboard/cobranzas',      Icon: DollarSign,  description: 'Cuenta corriente clientes' },
      { label: 'Recibos',   href: '/dashboard/recibos',        Icon: ReceiptText, description: 'Comprobantes emitidos'     },
    ],
  },
  {
    id: 'listados',
    label: 'Listados',
    headerIcon: BarChart3,
    color: 'slate',
    items: [
      { label: 'Cta. Cte. Clientes', href: '/dashboard/listados/cobranzas',        Icon: DollarSign, description: 'Saldos y movimientos'   },
      { label: 'Venta de artículos', href: '/dashboard/listados/ventas-articulos', Icon: Package,    description: 'Artículos más vendidos' },
      { label: 'Lista de precios',   href: '/dashboard/listados/precios',          Icon: Tag,        description: 'Precios por lista'      },
    ],
  },
  {
    id: 'optica',
    label: 'Óptica',
    module: 'optica',
    headerIcon: Wrench,
    color: 'indigo',
    items: [
      { label: 'Órdenes de trabajo', href: '/dashboard/optica/ordenes',              Icon: ClipboardList, description: 'Armado de lentes'          },
      { label: 'Servicios',          href: '/dashboard/optica/servicios',            Icon: Wrench,        description: 'Reparaciones y controles'  },
      { label: 'Médicos',            href: '/dashboard/optica/medicos',              Icon: Stethoscope,   description: 'Profesionales derivantes'  },
      { label: 'Importar óptica',    href: '/dashboard/inventario/importar-optica', Icon: FileUp,        description: 'Carga masiva de artículos' },
    ],
  },
  {
    id: 'admin',
    label: 'Administración',
    headerIcon: Settings,
    color: 'rose',
    items: [
      { label: 'Sucursales',       href: '/dashboard/admin/sucursales',    Icon: Building2,  description: 'Gestión de locales'  },
      { label: 'Usuarios',         href: '/dashboard/admin/usuarios',      Icon: Settings,   description: 'Cuentas de acceso'   },
      { label: 'Roles',            href: '/dashboard/admin/roles',         Icon: Shield,     description: 'Perfiles de usuario' },
      { label: 'Permisos',         href: '/dashboard/admin/permisos',      Icon: Lock,       description: 'Control de acceso'   },
      { label: 'Listas de precio', href: '/dashboard/admin/listas-precio', Icon: Tag,        description: 'Precios por canal'   },
      { label: 'Vendedores',       href: '/dashboard/admin/vendedores',    Icon: UserCheck,  description: 'Equipo de ventas'    },
      { label: 'Formas de pago',   href: '/dashboard/admin/formas-pago',   Icon: CreditCard, description: 'Métodos de cobro'    },
    ],
  },
]

export function ModuleSections({ modules, isAdmin }: { modules: string[]; isAdmin: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null)

  const visible = MODULE_SECTIONS.filter(
    s => !s.module || isAdmin || modules.includes(s.module)
  )

  return (
    <div className="mt-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {visible.map(section => {
          const isOpen = openId === section.id
          const c = CARD_COLORS[section.color]
          return (
            <div key={section.id} className="contents">
              <button
                onClick={() => setOpenId(isOpen ? null : section.id)}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl text-left transition-all shadow-sm',
                  isOpen
                    ? `${c.headerOpenBg} ring-2 ring-white/20`
                    : `${c.headerBg} ${c.headerHover}`
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <section.headerIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-white truncate">{section.label}</p>
                  <p className="text-xs text-white/70">{section.items.length} accesos</p>
                </div>
                <ChevronDown
                  className={cn('w-4 h-4 flex-shrink-0 text-white/70 transition-transform duration-200', isOpen && 'rotate-180')}
                />
              </button>
            </div>
          )
        })}
      </div>

      {visible.map(section => {
        if (openId !== section.id) return null
        const c = CARD_COLORS[section.color]
        return (
          <div key={section.id} className="mt-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {section.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex flex-col bg-white rounded-xl border border-gray-200 p-4 transition-all hover:shadow-md',
                    c.itemBorder
                  )}
                >
                  <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', c.itemIconBg)}>
                    <item.Icon className={cn('w-5 h-5', c.itemIcon)} />
                  </div>
                  <p className="font-semibold text-gray-800 text-sm leading-tight">{item.label}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-snug">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
