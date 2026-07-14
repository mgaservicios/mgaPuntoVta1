'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Printer, X } from 'lucide-react'
import type { PrecioRow } from '@/app/api/dashboard/listados/precios/route'

function formatARS(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

export default function PrintPreciosPage() {
  const searchParams = useSearchParams()
  const listaId = searchParams.get('lista_id') ?? ''
  const categoriaId = searchParams.get('categoria_id') ?? ''
  const subcategoriaId = searchParams.get('subcategoria_id') ?? ''
  const marcaId = searchParams.get('marca_id') ?? ''

  const [rows, setRows] = useState<PrecioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterLabels, setFilterLabels] = useState({
    lista: '',
    rubro: '',
    subrubro: '',
    marca: '',
  })
  const [sucursalNombre, setSucursalNombre] = useState('')
  const [sucursalLogo, setSucursalLogo] = useState<string | null>(null)

  useEffect(() => {
    const fetchSucursal = fetch('/api/dashboard/sucursales/selected')
      .then(r => r.json())
      .then((data: { id: number | null; nombre: string | null; logo_url: string | null } | null) => {
        if (data?.nombre) {
          setSucursalNombre(data.nombre)
          setSucursalLogo(data.logo_url ?? null)
        }
      })
      .catch(() => {})

    const fetchFilters = Promise.all([
      fetch('/api/dashboard/listas-precio').then(r => r.json()),
      fetch('/api/dashboard/categorias').then(r => r.json()),
      fetch('/api/dashboard/marcas').then(r => r.json()),
    ]).then(([listasData, catsData, marcasData]) => {
      const listas = Array.isArray(listasData) ? listasData : []
      const cats = Array.isArray(catsData) ? catsData : []
      const marcas = Array.isArray(marcasData) ? marcasData : []
      setFilterLabels({
        lista: listas.find((l: { id: number | string }) => String(l.id) === listaId)?.nombre ?? '',
        rubro: cats.find((c: { id: number | string }) => String(c.id) === categoriaId)?.nombre ?? '',
        subrubro: categoriaId
          ? (cats.find((c: { id: number | string }) => String(c.id) === categoriaId)?.subcategorias ?? [])
              .find((s: { id: number | string }) => String(s.id) === subcategoriaId)?.nombre ?? ''
          : '',
        marca: marcas.find((m: { id: number | string }) => String(m.id) === marcaId)?.nombre ?? '',
      })
    })

    const fetchPrecios = (async () => {
      const params = new URLSearchParams()
      if (listaId) params.set('lista_id', listaId)
      if (categoriaId) params.set('categoria_id', categoriaId)
      if (subcategoriaId) params.set('subcategoria_id', subcategoriaId)
      if (marcaId) params.set('marca_id', marcaId)
      try {
        const res = await fetch(`/api/dashboard/listados/precios?${params}`)
        const data = await res.json()
        if (data?.error) { setError(data.error); return }
        setRows(Array.isArray(data) ? data : [])
      } catch {
        setError('Error al cargar los precios')
      }
    })()

    Promise.all([fetchSucursal, fetchFilters, fetchPrecios]).then(() => setLoading(false))
  }, [listaId, categoriaId, subcategoriaId, marcaId])

  const hasVariantes = rows.some(r => r.variante_desc != null)
  const colCount = hasVariantes ? 4 : 3

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (error || rows.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        {error || 'Sin resultados para los filtros seleccionados'}
      </div>
    )
  }

  return (
    <>
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-6 py-3 bg-gray-900 text-white shadow-lg">
        <span className="text-sm font-medium mr-2">
          Lista de precios — {filterLabels.lista}
        </span>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => window.close()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
            Cerrar
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-500 transition-colors font-medium"
          >
            <Printer className="w-4 h-4" />
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      <div className="print:pt-0 pt-16 bg-white min-h-screen px-6 py-6 print:px-4 print:py-4">
        <div className="max-w-full mx-auto">
          {/* Encabezado */}
          <div className="flex items-center gap-4 mb-4 border-b-2 border-gray-800 pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sucursalLogo || '/logos/logo blanco.png'}
              alt="Logo"
              className="w-14 h-14 rounded-lg border border-gray-200 object-contain shrink-0"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-widest">{sucursalNombre}</p>
              <h1 className="text-xl font-bold text-gray-900">Listado de Precios</h1>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-3">
            <div className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
              <span className="text-xs text-gray-400 block">Lista</span>
              <span className="font-medium text-gray-800">{filterLabels.lista || '—'}</span>
            </div>
            {filterLabels.rubro && (
              <div className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                <span className="text-xs text-gray-400 block">Rubro</span>
                <span className="font-medium text-gray-800">{filterLabels.rubro}</span>
              </div>
            )}
            {filterLabels.subrubro && (
              <div className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                <span className="text-xs text-gray-400 block">Subrubro</span>
                <span className="font-medium text-gray-800">{filterLabels.subrubro}</span>
              </div>
            )}
            {filterLabels.marca && (
              <div className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5">
                <span className="text-xs text-gray-400 block">Marca</span>
                <span className="font-medium text-gray-800">{filterLabels.marca}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 text-center">
            Impreso: {new Date().toLocaleDateString('es-AR')} {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            {' · '}{rows.length} artículo{rows.length !== 1 ? 's' : ''}
          </p>

          {/* Tabla */}
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Código</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Artículo</th>
                {hasVariantes && <th className="text-left px-3 py-2 font-semibold text-gray-600">Variante</th>}
                <th className="text-right px-3 py-2 font-semibold text-gray-600">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={`${row.articulo_id}-${row.variante_id ?? 0}-${i}`} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{row.codigo ?? '—'}</td>
                  <td className="px-3 py-1.5">{row.articulo}</td>
                  {hasVariantes && (
                    <td className="px-3 py-1.5 text-gray-500">{row.variante_desc ?? '—'}</td>
                  )}
                  <td className="px-3 py-1.5 text-right font-medium">{formatARS(row.precio)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 text-center text-xs text-gray-400 border-t border-gray-200 pt-2">
            {rows.length} artículo{rows.length !== 1 ? 's' : ''} — Generado por MGA Pto. Venta
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}
