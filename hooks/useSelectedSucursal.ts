import { useEffect, useState } from 'react'

interface SelectedSucursal {
  id: number | null
  nombre: string | null
  isHome: boolean | null  // null = loading
  verTodas: boolean
}

export function useSelectedSucursal(): SelectedSucursal {
  const [state, setState] = useState<SelectedSucursal>({
    id: null, nombre: null, isHome: null, verTodas: false,
  })

  useEffect(() => {
    fetch('/api/dashboard/sucursales/selected')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setState({ id: d.id, nombre: d.nombre, isHome: d.isHome, verTodas: d.verTodas })
      })
      .catch(() => null)
  }, [])

  return state
}
