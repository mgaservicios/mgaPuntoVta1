import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import Sidebar from '@/components/dashboard/Sidebar'
import DashboardHeader, { QuickActionsBar } from '@/components/dashboard/Header'
import { PermissionsProvider } from '@/components/PermissionsProvider'
import { getTenantClient } from '@/services/supabase-tenant'
import { SUCURSAL_COOKIE, SUCURSAL_HOME_COOKIE, VER_TODAS_COOKIE } from '@/lib/sucursal'
import { ROUTE_TO_PERM } from '@/lib/perm-groups'
import { SessionGuard } from '@/components/SessionGuard'
import type { Sucursal } from '@/types/sucursales'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Returns true if the hex color is light (better suited for dark text) */
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
}

async function getSucursales(supabase: SupabaseClient, userId: string, role: string): Promise<Sucursal[]> {
  if (role === 'Administrador') {
    const { data } = await supabase
      .from('sucursales')
      .select('id, nombre, direccion, activo, logo_url, color')
      .eq('activo', true)
      .order('nombre')
    return (data ?? []) as Sucursal[]
  }

  const { data } = await supabase
    .from('user_sucursales')
    .select('sucursales(id, nombre, direccion, activo, logo_url, color)')
    .eq('user_id', userId)

  return (data ?? [])
    .flatMap((row) => (Array.isArray(row.sucursales) ? row.sucursales : [row.sucursales]))
    .filter((s): s is Sucursal => s !== null && !!s && (s as Sucursal).activo)
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || !session.user.empresa_id) redirect('/auth/reauth')

  const supabase = await getTenantClient(session)
  const isAdmin = session.user.role === 'Administrador'

  // Fetch sucursales y permisos de rol en paralelo — son independientes entre sí
  const [sucursales, permResult] = await Promise.all([
    getSucursales(supabase, session.user.id, session.user.role),
    isAdmin
      ? Promise.resolve(null)
      : supabase
          .from('role_permissions')
          .select('operation, allowed')
          .eq('role_id', session.user.role_id),
  ])

  const cookieStore = await cookies()
  const cookieVal = parseInt(cookieStore.get(SUCURSAL_COOKIE)?.value ?? '', 10) || null
  const homeCookieVal = parseInt(cookieStore.get(SUCURSAL_HOME_COOKIE)?.value ?? '', 10) || cookieVal
  const isValidCookie = cookieVal !== null && sucursales.some((s) => s.id === cookieVal)
  const verTodas = isAdmin && cookieStore.get(VER_TODAS_COOKIE)?.value === '1'

  if (!isValidCookie && !verTodas) {
    // If there are no active sucursales for this user, init-session would also find nothing and
    // set a stale cookie → infinite loop. Sign out instead so the user sees a clear error.
    if (sucursales.length === 0) redirect('/auth/reauth')
    redirect('/api/auth/init-session')
  }

  const activeSucursalId = verTodas ? null : cookieVal as number

  const activeSucursal = sucursales.find((s) => s.id === (activeSucursalId ?? homeCookieVal))
  const sidebarLogoUrl = activeSucursal?.logo_url ?? null
  const sidebarColor   = activeSucursal?.color ?? null

  // Only use validated hex colors to prevent injection
  const brandColor = /^#[0-9A-Fa-f]{6}$/.test(sidebarColor ?? '') ? sidebarColor! : null

  // Home sucursal may not be in the visible list if it was deactivated; look it up separately if needed
  let homeSucursalNombre: string | null =
    sucursales.find((s) => s.id === homeCookieVal)?.nombre ?? null
  if (!homeSucursalNombre && homeCookieVal) {
    const { data: homeSuc } = await supabase
      .from('sucursales')
      .select('nombre')
      .eq('id', homeCookieVal)
      .single()
    homeSucursalNombre = homeSuc?.nombre ?? null
  }

  // Build permission map for non-admin users using the prefetched permResult
  // null = admin (show/allow everything)
  let permMap: Record<string, boolean> | null = null

  if (!isAdmin && permResult) {
    permMap = {}
    for (const row of (permResult.data ?? []) as Array<{ operation: string; allowed: boolean }>) {
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

  const brandFg = brandColor ? (isLightColor(brandColor) ? '#000000' : '#ffffff') : null

  return (
    <>
    {brandColor && (
      <style>{`
        :root {
          --primary: ${brandColor};
          --primary-foreground: ${brandFg};
          --ring: ${brandColor};
        }
      `}</style>
    )}
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        userName={session.user.name ?? ''}
        userRole={session.user.role}
        userModules={session.user.modules ?? []}
        userPermissions={permMap}
        logoUrl={sidebarLogoUrl}
        color={sidebarColor}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader
          userName={session.user.name ?? ''}
          userRole={session.user.role}
          sucursales={sucursales}
          activeSucursalId={activeSucursalId}
          isAdmin={isAdmin}
          verTodas={verTodas}
          homeSucursalNombre={homeSucursalNombre}
          empresaNombre={session.user.empresa_nombre ?? ''}
        />
        <QuickActionsBar modules={session.user.modules ?? []} color={brandColor} userPermissions={permMap} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <SessionGuard />
          <PermissionsProvider permissions={permMap} modules={session.user.modules ?? []}>
            {children}
          </PermissionsProvider>
        </main>
      </div>
    </div>
    </>
  )
}
