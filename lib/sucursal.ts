import { cookies } from 'next/headers'

export const SUCURSAL_COOKIE = 'sucursal_id'
export const VER_TODAS_COOKIE = 'ver_todas'

export async function getActiveSucursalId(): Promise<number | null> {
  const store = await cookies()
  const val = store.get(SUCURSAL_COOKIE)?.value
  return val ? parseInt(val, 10) : null
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
