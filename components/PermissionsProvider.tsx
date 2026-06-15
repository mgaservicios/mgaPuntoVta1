'use client'

import { createContext, useContext } from 'react'

type PermissionsCtx = {
  permissions: Record<string, boolean> | null
  modules: string[]
}

// null permissions = Administrador (acceso total)
const PermissionsContext = createContext<PermissionsCtx>({ permissions: null, modules: [] })

export function PermissionsProvider({
  permissions,
  modules,
  children,
}: {
  permissions: Record<string, boolean> | null
  modules: string[]
  children: React.ReactNode
}) {
  return (
    <PermissionsContext.Provider value={{ permissions, modules }}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const { permissions, modules } = useContext(PermissionsContext)
  const can = (op: string) => permissions === null || permissions[op] === true
  return { can, isAdmin: permissions === null, modules }
}
