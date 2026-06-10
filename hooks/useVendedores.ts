'use client'

import { useState, useEffect } from 'react'

export interface VendedorOption {
  id: number
  nombre: string
}

export function useVendedores(): VendedorOption[] {
  const [vendedores, setVendedores] = useState<VendedorOption[]>([])

  useEffect(() => {
    fetch('/api/dashboard/vendedores')
      .then(r => r.ok ? r.json() : [])
      .then(setVendedores)
      .catch(() => null)
  }, [])

  return vendedores
}
