'use client'

import { useState, useEffect } from 'react'

interface VarianteResult {
  id: number
  sku: string | null
  precio_venta: number | null
  stock_actual: number
  variante_atributos?: { valor: string; atributo_tipos?: { nombre: string } | null }[]
}

interface ArticuloResult {
  id: number
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function varianteLabel(v: VarianteResult) {
  const attrs = v.variante_atributos ?? []
  if (attrs.length === 0) return v.sku ?? `Variante #${v.id}`
  return attrs.map(a => `${a.atributo_tipos?.nombre ?? ''}: ${a.valor}`).join(' / ')
}

export default function VarianteSelector({
  articulo,
  onSelect,
}: {
  articulo: ArticuloResult
  onSelect: (v: VarianteResult) => void
}) {
  const [variantes, setVariantes] = useState<VarianteResult[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/dashboard/articulos/${articulo.id}`)
      .then(r => r.json())
      .then(data => {
        setVariantes(data.articulo_variantes?.filter((v: VarianteResult & { activo: boolean }) => v.activo) ?? [])
        setLoading(false)
      })
  }, [articulo.id])

  if (loading) return <p className="text-xs text-gray-400 px-2 py-1">Cargando variantes…</p>
  if (!variantes || variantes.length === 0)
    return <p className="text-xs text-gray-400 px-2 py-1">Sin variantes activas</p>

  return (
    <div className="border-t border-gray-100 bg-gray-50">
      <p className="text-xs font-medium text-gray-500 px-3 py-1.5">Seleccioná una variante:</p>
      {variantes.map(v => (
        <button
          key={v.id}
          onMouseDown={(e) => { e.preventDefault(); onSelect(v) }}
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center justify-between gap-4 text-sm"
        >
          <span className="text-gray-700">{varianteLabel(v)}</span>
          <span className="text-gray-500 text-xs shrink-0">
            {v.precio_venta != null ? formatARS(v.precio_venta) : 'Sin precio'} · Stock: {v.stock_actual}
          </span>
        </button>
      ))}
    </div>
  )
}
