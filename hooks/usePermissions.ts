'use client'
import { useEffect, useState } from 'react'
import type { ModulePermisos } from '@/lib/permisos'

const NONE: ModulePermisos = { can_view: false, can_create: false, can_edit: false, can_delete: false }

let cache: Record<string, ModulePermisos> | null = null
let inflight: Promise<Record<string, ModulePermisos>> | null = null

async function loadPermisos(): Promise<Record<string, ModulePermisos>> {
  if (cache) return cache
  if (!inflight) {
    inflight = fetch('/api/dashboard/permissions')
      .then((r) => r.json())
      .then((rows: Array<{ module: string } & ModulePermisos>) => {
        cache = Object.fromEntries(rows.map((r) => [r.module, r]))
        inflight = null
        return cache!
      })
  }
  return inflight
}

export function usePermissions(module: string): ModulePermisos {
  const [perm, setPerm] = useState<ModulePermisos>(NONE)
  useEffect(() => {
    loadPermisos().then((all) => setPerm(all[module] ?? NONE))
  }, [module])
  return perm
}
