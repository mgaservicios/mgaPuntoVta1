'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Printer, X } from 'lucide-react'
import type { MovRow, MovimientosResponse } from '@/app/api/dashboard/listados/movimientos-caja/route'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
  })
}

const FUENTE_LABELS: Record<string, string> = {
  caja: 'Caja',
  venta: 'Venta POS',
  ov: 'Orden de venta',
  ot: 'Óptica OT',
  sv: 'Óptica SV',
}

export default function PrintMovimientosPage() {
  const searchParams = useSearchParams()
  const desde = searchParams.get('desde') ?? ''
  const hasta = searchParams.get('hasta') ?? ''
  const sucParam = searchParams.get('sucursal_id') ?? ''

  const [rows, setRows] = useState<MovRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totales, setTotales] = useState({ total_ingresos: 0, total_egresos: 0, saldo: 0 })
  const [sucursalNombre, setSucursalNombre] = useState('')
  const [sucursalLogo, setSucursalLogo] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    if (sucParam) params.set('sucursal_id', sucParam)

    const fetchSucursal = fetch('/api/dashboard/sucursales/selected')
      .then(r => r.json())
      .then((data: { id: number | null; nombre: string | null; logo_url: string | null } | null) => {
        if (data?.nombre) {
          setSucursalNombre(data.nombre)
          setSucursalLogo(data.logo_url ?? null)
        }
      })
      .catch(() => {})

    const fetchMovimientos = fetch(`/api/dashboard/listados/movimientos-caja?${params}`)
      .then(r => r.json())
      .then((data: MovimientosResponse & { error?: string }) => {
        if (data?.error) { setError(data.error); return }
        setRows(data.movimientos ?? [])
        setTotales({
          total_ingresos: data.total_ingresos ?? 0,
          total_egresos: data.total_egresos ?? 0,
          saldo: data.saldo ?? 0,
        })
      })
      .catch(() => { setError('Error al cargar los movimientos') })

    Promise.all([fetchSucursal, fetchMovimientos]).then(() => setLoading(false))
  }, [desde, hasta, sucParam, searchParams])

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
        {error || 'Sin movimientos para el período seleccionado'}
      </div>
    )
  }

  return (
    <>
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-6 py-3 bg-gray-900 text-white shadow-lg">
        <span className="text-sm font-medium mr-2">
          Movimientos de Caja — {desde} a {hasta}
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
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-400 uppercase tracking-widest">{sucursalNombre}</p>
              <h1 className="text-xl font-bold text-gray-900">Listado de Movimientos de Caja</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Período: {desde} al {hasta}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Impreso: {new Date().toLocaleDateString('es-AR')} {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Totales */}
          <div className="flex justify-between gap-4 mb-4 text-sm">
            <div className="flex-1 text-center border rounded px-3 py-2 bg-green-50">
              <p className="text-xs text-green-600 font-medium">Ingresos</p>
              <p className="font-bold text-green-700">{formatARS(totales.total_ingresos)}</p>
            </div>
            <div className="flex-1 text-center border rounded px-3 py-2 bg-red-50">
              <p className="text-xs text-red-600 font-medium">Egresos</p>
              <p className="font-bold text-red-700">{formatARS(totales.total_egresos)}</p>
            </div>
            <div className={`flex-1 text-center border rounded px-3 py-2 ${totales.saldo >= 0 ? 'bg-blue-50' : 'bg-amber-50'}`}>
              <p className={`text-xs font-medium ${totales.saldo >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>Saldo</p>
              <p className={`font-bold ${totales.saldo >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>{formatARS(totales.saldo)}</p>
            </div>
          </div>

          {/* Tabla */}
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Fecha</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Tipo</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Concepto</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Fuente</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600">Método</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-600">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => (
                <tr key={`${row.fuente}-${row.id}`} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {formatFecha(row.created_at)} {formatHora(row.created_at)}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                      row.tipo === 'ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {row.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">{row.concepto}</td>
                  <td className="px-3 py-1.5 text-gray-500">{FUENTE_LABELS[row.fuente] ?? row.fuente}</td>
                  <td className="px-3 py-1.5 text-gray-500">{row.metodo || '—'}</td>
                  <td className={`px-3 py-1.5 text-right font-medium ${row.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>
                    {row.tipo === 'ingreso' ? '+' : '−'}{formatARS(row.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pie */}
          <div className="mt-4 text-center text-xs text-gray-400 border-t border-gray-200 pt-2">
            {rows.length} movimiento{rows.length !== 1 ? 's' : ''} — Generado por MGA Pto. Venta
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}
