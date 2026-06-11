'use client'

import { createContext, useContext } from 'react'

// null = Administrador (acceso total); Record = mapa de operaciones para no-admin
const PermissionsContext = createContext<Record<string, boolean> | null>(null)

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: Record<string, boolean> | null
  children: React.ReactNode
}) {
  return (
    <PermissionsContext.Provider value={permissions}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext)
  // null = admin → todo permitido
  const can = (op: string) => ctx === null || ctx[op] === true
  return { can, isAdmin: ctx === null }
}
