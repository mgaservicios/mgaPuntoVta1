import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const SUCURSAL_COOKIE = 'sucursal_id'
export const SUCURSAL_HOME_COOKIE = 'sucursal_home_id'
export const VER_TODAS_COOKIE = 'ver_todas'

export async function getActiveSucursalId(): Promise<number | null> {
  const store = await cookies()
  const val = store.get(SUCURSAL_COOKIE)?.value
  return val ? parseInt(val, 10) : null
}

// Returns the sucursal the user originally logged into — never changes when switching views.
// Falls back to SUCURSAL_COOKIE for sessions created before this feature was added.
export async function getHomeSucursalId(): Promise<number | null> {
  const store = await cookies()
  const home = store.get(SUCURSAL_HOME_COOKIE)?.value
  if (home) return parseInt(home, 10)
  const fallback = store.get(SUCURSAL_COOKIE)?.value
  return fallback ? parseInt(fallback, 10) : null
}

export async function getVerTodas(): Promise<boolean> {
  const store = await cookies()
  return store.get(VER_TODAS_COOKIE)?.value === '1'
}

// Use this in API routes instead of getActiveSucursalId() when the route supports "ver todas"
export async function getSucursalFilter(): Promise<{ sucursalId: number | null; verTodas: boolean }> {
  const store = await cookies()
  const verTodas = store.get(VER_TODAS_COOKIE)?.value === '1'
  const val = store.get(SUCURSAL_COOKIE)?.value
  const sucursalId = val ? parseInt(val, 10) : null
  return { sucursalId, verTodas }
}

// Returns 403 JSON response if the record's sucursal doesn't match the home sucursal.
// Use in PUT/DELETE routes to prevent modifying records from other sucursales.
export async function assertHomeSucursal(recordSucursalId: number | null): Promise<NextResponse | null> {
  const homeId = await getHomeSucursalId()
  if (!homeId) return NextResponse.json({ error: 'Sin sucursal de inicio de sesión' }, { status: 403 })
  if (recordSucursalId !== homeId) {
    return NextResponse.json({ error: 'No puede modificar datos de otra sucursal' }, { status: 403 })
  }
  return null
}
