import { useEffect, useState } from 'react'

interface SucursalActivaData {
  nombre: string | null
  isHome: boolean
}

export function useSucursalActiva(): SucursalActivaData {
  const [data, setData] = useState<SucursalActivaData>({ nombre: null, isHome: true })

  useEffect(() => {
    fetch('/api/dashboard/sucursales/activa')
      .then(r => r.ok ? r.json() : null)
      .then(d => setData({ nombre: d?.nombre ?? null, isHome: d?.isHome ?? true }))
      .catch(() => null)
  }, [])

  return data
}
