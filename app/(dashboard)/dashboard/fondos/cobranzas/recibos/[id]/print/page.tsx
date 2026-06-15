'use client'

import { useEffect, useState, use } from 'react'
import { Printer, X } from 'lucide-react'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}
function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const METODO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia',
  TARJETA_DEBITO: 'Tarjeta débito', TARJETA_CREDITO: 'Tarjeta crédito',
  CHEQUE: 'Cheque', OTRO: 'Otro',
}

interface ReciboData {
  id: number
  monto: number
  fecha: string
  descripcion: string | null
  metodo: string | null
  clientes: { nombre: string } | null
  sucursales: { nombre: string; logo_url: string | null } | null
  saldo_actual: number
}

function Logo({ url }: { url?: string | null }) {
  return (
    <div className="w-14 h-14 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url || '/logos/logo blanco.png'}
        alt="Logo"
        className="w-[85%] h-[85%] object-contain"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
    </div>
  )
}

function ReciboLayout({ recibo }: { recibo: ReciboData }) {
  const nro = String(recibo.id).padStart(6, '0')
  const saldoPost = recibo.saldo_actual
  const aFavor = saldoPost < -0.001

  return (
    <div className="max-w-[148mm] mx-auto px-8 py-6 print:px-6 print:py-4 text-gray-900">

      {/* Encabezado */}
      <div className="flex items-center gap-4 border-b-2 border-gray-800 pb-4 mb-5">
        <Logo url={recibo.sucursales?.logo_url} />
        <div className="flex-1">
          <p className="text-xs text-gray-500 uppercase tracking-widest">
            {recibo.sucursales?.nombre ?? ''}
          </p>
          <p className="text-xl font-bold text-gray-900">Recibo de cobro</p>
          <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500 border border-gray-400 rounded px-2 py-0.5">
            Comprobante sin validez fiscal
          </span>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Nro.</p>
          <p className="font-mono font-bold text-gray-800 text-lg">REC-{nro}</p>
          <p className="text-xs text-gray-500">{formatFecha(recibo.fecha)}</p>
        </div>
      </div>

      {/* Cliente */}
      <div className="mb-5 border border-gray-200 rounded-lg p-4 bg-gray-50">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Cliente</p>
        <p className="text-base font-semibold text-gray-900">
          {recibo.clientes?.nombre ?? `Cliente #`}
        </p>
      </div>

      {/* Detalle del cobro */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Detalle</p>
        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="px-4 py-2.5 text-gray-500">Concepto</td>
              <td className="px-4 py-2.5 font-medium text-gray-800">
                {recibo.descripcion || 'Cobro en cuenta corriente'}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 text-gray-500">Forma de cobro</td>
              <td className="px-4 py-2.5 font-medium">
                {recibo.metodo ? (METODO_LABELS[recibo.metodo] ?? recibo.metodo) : '—'}
              </td>
            </tr>
            <tr className="bg-blue-50">
              <td className="px-4 py-2.5 font-semibold text-gray-700">Importe cobrado</td>
              <td className="px-4 py-2.5 font-bold text-blue-700 text-base">
                {formatARS(recibo.monto)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Saldo resultante */}
      <div className={`mb-6 rounded-lg p-4 border ${aFavor ? 'bg-green-50 border-green-200' : saldoPost > 0.001 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
        <div className="flex justify-between items-center">
          <p className="text-sm font-semibold text-gray-600">
            {aFavor ? 'Saldo a favor del cliente' : saldoPost > 0.001 ? 'Saldo pendiente' : 'Cuenta corriente al día'}
          </p>
          <p className={`text-base font-bold ${aFavor ? 'text-green-700' : saldoPost > 0.001 ? 'text-amber-700' : 'text-green-700'}`}>
            {formatARS(Math.abs(saldoPost))}
          </p>
        </div>
      </div>

      {/* Firma */}
      <div className="mt-8 flex justify-between items-end">
        <div className="text-center">
          <div className="border-t border-gray-400 w-40 mx-auto mb-1" />
          <p className="text-xs text-gray-400">Firma del cliente</p>
        </div>
        <div className="text-center">
          <div className="border-t border-gray-400 w-40 mx-auto mb-1" />
          <p className="text-xs text-gray-400">Firma y sello</p>
        </div>
      </div>

      {/* Pie */}
      <div className="border-t border-gray-200 mt-6 pt-3 text-center text-[10px] text-gray-400">
        REC-{nro} · {formatFecha(recibo.fecha)}
      </div>
    </div>
  )
}

export default function PrintReciboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [recibo, setRecibo] = useState<ReciboData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/dashboard/cobranzas/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data?.error) { setError(data.error); setLoading(false); return }
        setRecibo(data)
        setLoading(false)
      })
      .catch(() => { setError('Error al cargar el recibo'); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (error || !recibo) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600">
        {error || 'Recibo no encontrado'}
      </div>
    )
  }

  return (
    <>
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-6 py-3 bg-gray-900 text-white shadow-lg">
        <span className="text-sm font-medium mr-2">
          Recibo REC-{String(recibo.id).padStart(6, '0')} — {recibo.clientes?.nombre}
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

      <div className="print:pt-0 pt-16 bg-white min-h-screen">
        <ReciboLayout recibo={recibo} />
      </div>

      <style>{`
        @media print {
          @page { size: A5; margin: 10mm 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}
