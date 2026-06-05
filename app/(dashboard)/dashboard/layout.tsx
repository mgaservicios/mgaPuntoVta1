import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import Sidebar from '@/components/dashboard/Sidebar'
import DashboardHeader from '@/components/dashboard/Header'
import { getTenantClient } from '@/services/supabase-tenant'
import { SUCURSAL_COOKIE, VER_TODAS_COOKIE } from '@/lib/sucursal'
import { ROUTE_TO_PERM } from '@/lib/perm-groups'
import type { Sucursal } from '@/types/sucursales'
import type { SupabaseClient } from '@supabase/supabase-js'

async function getSucursales(supabase: SupabaseClient, userId: string, role: string): Promise<Sucursal[]> {
  if (role === 'Administrador') {
    const { data } = await supabase
      .from('sucursales')
      .select('id, nombre, direccion, activo')
      .eq('activo', true)
      .order('nombre')
    return (data ?? []) as Sucursal[]
  }

  const { data } = await supabase
    .from('user_sucursales')
    .select('sucursales(id, nombre, direccion, activo)')
    .eq('user_id', userId)

  return (data ?? [])
    .flatMap((row) => (Array.isArray(row.sucursales) ? row.sucursales : [row.sucursales]))
    .filter((s): s is Sucursal => s !== null && !!s && (s as Sucursal).activo)
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || !session.user.empresa_id) redirect('/auth/reauth')

  const supabase = await getTenantClient(session)
  const sucursales = await getSucursales(supabase, session.user.id, session.user.role)

  const isAdmin = session.user.role === 'Administrador'
  const cookieStore = await cookies()
  const cookieVal = parseInt(cookieStore.get(SUCURSAL_COOKIE)?.value ?? '', 10) || null
  const isValidCookie = cookieVal !== null && sucursales.some((s) => s.id === cookieVal)
  const verTodas = isAdmin && cookieStore.get(VER_TODAS_COOKIE)?.value === '1'

  if (!isValidCookie && !verTodas) {
    redirect('/api/auth/init-session')
  }

  const activeSucursalId = verTodas ? null : cookieVal as number

  // Build permission map for non-admin users
  // null = admin (show/allow everything)
  let permMap: Record<string, boolean> | null = null

  if (!isAdmin) {
    const { data } = await supabase
      .from('role_permissions')
      .select('operation, allowed')
      .eq('role_id', session.user.role_id)

    permMap = {}
    for (const row of data ?? []) {
      permMap[row.operation] = row.allowed
    }

    // Check permission for the current route
    const headersList = await headers()
    const pathname = headersList.get('x-pathname') ?? '/'

    const match = ROUTE_TO_PERM.find(
      ([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/')
    )
    if (match) {
      const [, permKey] = match
      if (!permMap[permKey]) {
        redirect('/dashboard')
      }
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        userName={session.user.name ?? ''}
        userRole={session.user.role}
        userModules={session.user.modules ?? []}
        userPermissions={permMap}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader
          userName={session.user.name ?? ''}
          userRole={session.user.role}
          sucursales={sucursales}
          activeSucursalId={activeSucursalId}
          isAdmin={isAdmin}
          verTodas={verTodas}
        />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
