'use client'

import { useEffect, useState, Fragment } from 'react'
import { useSearchParams } from 'next/navigation'
import { Printer, X } from 'lucide-react'
import type { VentaArticuloRow } from '@/app/api/dashboard/listados/ventas-articulos/route'

function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function groupByDay(rows: VentaArticuloRow[]): Array<{ fecha: string; rows: VentaArticuloRow[] }> {
  const map = new Map<string, VentaArticuloRow[]>()
  for (const row of rows) {
    const existing = map.get(row.fecha) ?? []
    existing.push(row)
    map.set(row.fecha, existing)
  }
  return Array.from(map.entries()).map(([fecha, gRows]) => ({ fecha, rows: gRows }))
}

const TIPO_LABELS: Record<string, string> = { todos: 'Todos', venta: 'Venta', receta: 'Receta' }

export default function PrintVentasArticulosPage() {
  const searchParams = useSearchParams()
  const desde = searchParams.get('desde') ?? ''
  const hasta = searchParams.get('hasta') ?? ''
  const tipo = searchParams.get('tipo') ?? 'todos'

  const [rows, setRows] = useState<VentaArticuloRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sucursalNombre, setSucursalNombre] = useState('')
  const [sucursalLogo, setSucursalLogo] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    if (tipo !== 'todos') params.set('tipo', tipo)

    const fetchSucursal = fetch('/api/dashboard/sucursales/selected')
      .then(r => r.json())
      .then((data: { id: number | null; nombre: string | null; logo_url: string | null } | null) => {
        if (data?.nombre) {
          setSucursalNombre(data.nombre)
          setSucursalLogo(data.logo_url ?? null)
        }
      })
      .catch(() => {})

    const fetchRows = fetch(`/api/dashboard/listados/ventas-articulos?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data?.error) { setError(data.error); return }
        setRows(Array.isArray(data) ? data : [])
      })
      .catch(() => { setError('Error al cargar los datos') })

    Promise.all([fetchSucursal, fetchRows]).then(() => setLoading(false))
  }, [desde, hasta, tipo])

  const groups = groupByDay(rows)

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
        {error || 'Sin ventas en el período seleccionado'}
      </div>
    )
  }

  return (
    <>
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-6 py-3 bg-gray-900 text-white shadow-lg">
        <span className="text-sm font-medium mr-2">
          Venta de artículos — {TIPO_LABELS[tipo] ?? tipo}
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
          <div className="flex items-center gap-4 mb-6 border-b-2 border-gray-800 pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sucursalLogo || '/logos/logo blanco.png'}
              alt="Logo"
              className="w-14 h-14 rounded-lg border border-gray-200 object-contain shrink-0"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-widest">{sucursalNombre}</p>
              <h1 className="text-xl font-bold text-gray-900">Listado de Venta de Artículos</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Tipo: {TIPO_LABELS[tipo] ?? tipo}
                {desde && ` · Desde: ${desde}`}
                {hasta && ` · Hasta: ${hasta}`}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Impreso: {new Date().toLocaleDateString('es-AR')} {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                {' · '}{rows.length} registro{rows.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Tabla agrupada por día */}
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Artículo</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Cliente</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Comprobante</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-600">Cant.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groups.map(group => (
                <Fragment key={group.fecha}>
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td colSpan={4} className="px-3 py-1.5 font-semibold text-sm text-gray-700">
                      {formatFecha(group.fecha)}
                    </td>
                  </tr>
                  {group.rows
                    .slice()
                    .sort((a, b) => a.articulo.localeCompare(b.articulo))
                    .map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5">{row.articulo}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.cliente ?? '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{row.comprobante}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{row.cantidad}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>

          <div className="mt-4 text-center text-xs text-gray-400 border-t border-gray-200 pt-2">
            {rows.length} registro{rows.length !== 1 ? 's' : ''} — Generado por MGA Pto. Venta
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
