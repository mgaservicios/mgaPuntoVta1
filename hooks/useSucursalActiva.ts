import { useEffect, useState } from 'react'

export function useSucursalActiva() {
  const [nombre, setNombre] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/sucursales/activa')
      .then(r => r.ok ? r.json() : null)
      .then(d => setNombre(d?.nombre ?? null))
      .catch(() => null)
  }, [])

  return nombre
}
