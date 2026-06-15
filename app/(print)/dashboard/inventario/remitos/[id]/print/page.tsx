'use client'

import { useEffect, useRef, useState, use } from 'react'
import { Printer, X } from 'lucide-react'
import JsBarcode from 'jsbarcode'
import type { Remito } from '@/types/stock'

type RemitoDetail = Remito & { sucursal_nombre: string; contraparte_display: string }

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatNum(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

const TIPO_LABELS: Record<string, string> = { entrada: 'Entrada', salida: 'Salida' }
const ESTADO_LABELS: Record<string, string> = { borrador: 'Borrador', confirmado: 'Confirmado', anulado: 'Anulado' }
const CONTRAPARTE_LABELS: Record<string, string> = { sucursal: 'Sucursal', proveedor: 'Proveedor', persona: 'Persona' }

type Formato = 'a4' | 'ticket'

// ── Barcode ───────────────────────────────────────────────────────────────────

function Barcode({ value, width = 2, height = 48 }: { value: string; width?: number; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (svgRef.current && value) {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128', width, height,
        displayValue: true, fontSize: 11, margin: 0, background: 'transparent',
      })
    }
  }, [value, width, height])
  return <svg ref={svgRef} />
}

// ── Logo ──────────────────────────────────────────────────────────────────────

function Logo({ size = 16 }: { size?: number }) {
  return (
    <div className={`w-${size} h-${size} bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logos/logo blanco.png" alt="Logo" className="w-[85%] h-[85%] object-contain"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
    </div>
  )
}

// ── Layout A4 ─────────────────────────────────────────────────────────────────

function LayoutA4({ remito }: { remito: RemitoDetail }) {
  const items = remito.remito_items ?? []
  const totalCosto = remito.tipo === 'entrada'
    ? items.reduce((acc, it) => acc + (it.costo_unitario != null ? Number(it.costo_unitario) * Number(it.cantidad) : 0), 0)
    : null

  return (
    <div className="max-w-[210mm] mx-auto px-8 py-6 print:px-6 print:py-4 text-gray-900">

      {/* ══ ENCABEZADO ══ */}
      <div className="flex items-center gap-4 border-b-2 border-gray-800 pb-4 mb-5">
        <Logo size={16} />

        <div className="shrink-0">
          <Barcode value={remito.numero} width={1.8} height={44} />
        </div>

        <div className="w-px self-stretch bg-gray-200 mx-1 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-bold text-gray-900 leading-tight">
                Remito de {TIPO_LABELS[remito.tipo]}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                <span className="text-gray-400">{CONTRAPARTE_LABELS[remito.contraparte_tipo]}:</span>{' '}
                {remito.contraparte_display}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{remito.sucursal_nombre}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono font-bold text-gray-700 text-sm">{remito.numero}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatFecha(remito.fecha)}</p>
              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded mt-1 inline-block ${
                remito.estado === 'confirmado' ? 'bg-blue-100 text-blue-700'
                : remito.estado === 'anulado'  ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600'
              }`}>
                {ESTADO_LABELS[remito.estado]}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ DATOS DEL REMITO ══ */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Tipo</p>
          <p className="text-sm font-semibold">{TIPO_LABELS[remito.tipo]}</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Sucursal</p>
          <p className="text-sm font-semibold">{remito.sucursal_nombre}</p>
        </div>
        {remito.nro_externo && (
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Factura / Remito</p>
            <p className="text-sm font-semibold">{remito.nro_externo}</p>
          </div>
        )}
      </div>

      {/* ══ ARTÍCULOS ══ */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Artículos</p>
        <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">Artículo</th>
              <th className="text-left px-2 py-2 font-semibold text-gray-600 w-28">SKU / Variante</th>
              <th className="text-right px-2 py-2 font-semibold text-gray-600 w-20">Cantidad</th>
              {remito.tipo === 'entrada' && (
                <th className="text-right px-3 py-2 font-semibold text-gray-600 w-28">Costo unit.</th>
              )}
              {remito.tipo === 'entrada' && (
                <th className="text-right px-3 py-2 font-semibold text-gray-600 w-28">Subtotal</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, i) => {
              const subtotal = item.costo_unitario != null
                ? Number(item.costo_unitario) * Number(item.cantidad)
                : null
              return (
                <tr key={item.id ?? i}>
                  <td className="px-3 py-2 font-medium">
                    {item.articulos?.nombre ?? `#${item.articulo_id}`}
                    {item.articulos?.codigo && (
                      <span className="block text-gray-400 font-normal font-mono">{item.articulos.codigo}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-gray-500 font-mono">
                    {item.articulo_variantes?.sku ?? (item.variante_id ? `#${item.variante_id}` : '—')}
                  </td>
                  <td className="px-2 py-2 text-right">{Number(item.cantidad).toLocaleString('es-AR')}</td>
                  {remito.tipo === 'entrada' && (
                    <td className="px-3 py-2 text-right">{item.costo_unitario != null ? `$${formatNum(item.costo_unitario)}` : '—'}</td>
                  )}
                  {remito.tipo === 'entrada' && (
                    <td className="px-3 py-2 text-right font-medium">{subtotal != null ? formatARS(subtotal) : '—'}</td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ══ TOTAL (solo entrada con costos) ══ */}
      {remito.tipo === 'entrada' && totalCosto != null && totalCosto > 0 && (
        <div className="flex justify-end mb-5">
          <div className="w-56 space-y-1 text-xs">
            <div className="flex justify-between font-bold text-sm border-t border-gray-200 pt-1.5">
              <span>TOTAL</span>
              <span>{formatARS(totalCosto)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ══ OBSERVACIONES ══ */}
      {remito.observaciones && (
        <div className="mb-5 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Observaciones</p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{remito.observaciones}</p>
        </div>
      )}

      {/* ══ PIE ══ */}
      <div className="border-t border-gray-200 pt-3 text-center text-xs text-gray-400">
        <p>Remito {remito.numero} · {TIPO_LABELS[remito.tipo]} · Emitido el {formatFecha(remito.fecha)}</p>
        <p className="mt-0.5 text-[10px] font-bold tracking-widest uppercase">Comprobante sin validez fiscal</p>
      </div>
    </div>
  )
}

// ── Layout Ticket 80mm ────────────────────────────────────────────────────────

function LayoutTicket({ remito }: { remito: RemitoDetail }) {
  const items = remito.remito_items ?? []
  const totalCosto = remito.tipo === 'entrada'
    ? items.reduce((acc, it) => acc + (it.costo_unitario != null ? Number(it.costo_unitario) * Number(it.cantidad) : 0), 0)
    : null

  return (
    <div className="max-w-[80mm] mx-auto px-4 py-6 print:px-3 print:py-3 text-gray-900 text-xs">

      {/* ══ ENCABEZADO ══ */}
      <div className="flex flex-col items-center gap-2 border-b-2 border-gray-800 pb-3 mb-3">
        <Logo size={14} />
        <Barcode value={remito.numero} width={1.6} height={38} />
        <div className="text-center">
          <p className="font-bold text-sm font-mono">{remito.numero}</p>
          <p className="text-gray-500 text-[11px]">{formatFecha(remito.fecha)}</p>
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-500 mt-0.5">Comprobante sin validez fiscal</p>
        </div>
      </div>

      {/* ══ DATOS ══ */}
      <div className="mb-3 space-y-1">
        <div><span className="text-gray-500">Tipo: </span><span className="font-medium">{TIPO_LABELS[remito.tipo]}</span></div>
        <div><span className="text-gray-500">Sucursal: </span><span className="font-medium">{remito.sucursal_nombre}</span></div>
        <div>
          <span className="text-gray-500">{CONTRAPARTE_LABELS[remito.contraparte_tipo]}: </span>
          <span className="font-medium">{remito.contraparte_display}</span>
        </div>
        {remito.nro_externo && (
          <div><span className="text-gray-500">Factura/Remito: </span><span className="font-medium">{remito.nro_externo}</span></div>
        )}
        <div>
          <span className="text-gray-500">Estado: </span>
          <span className="font-medium">{ESTADO_LABELS[remito.estado]}</span>
        </div>
      </div>

      {/* ══ ARTÍCULOS ══ */}
      <div className="mb-3">
        <div className="flex justify-between font-semibold text-gray-600 border-b border-dashed border-gray-300 pb-1 mb-2">
          <span>Artículo</span>
          <span>Cant.</span>
        </div>
        {items.map((item, i) => (
          <div key={item.id ?? i} className="mb-2">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <p className="font-medium leading-tight">{item.articulos?.nombre ?? `#${item.articulo_id}`}</p>
                {item.articulos?.codigo && (
                  <p className="text-gray-400 text-[10px] font-mono">{item.articulos.codigo}</p>
                )}
                {item.articulo_variantes?.sku && (
                  <p className="text-gray-400 text-[10px] font-mono">{item.articulo_variantes.sku}</p>
                )}
                {remito.tipo === 'entrada' && item.costo_unitario != null && (
                  <p className="text-gray-500 text-[10px]">Costo: ${formatNum(item.costo_unitario)}</p>
                )}
              </div>
              <span className="font-medium shrink-0">{Number(item.cantidad).toLocaleString('es-AR')}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ══ TOTAL ══ */}
      {remito.tipo === 'entrada' && totalCosto != null && totalCosto > 0 && (
        <div className="border-t border-dashed border-gray-300 pt-2 mb-3">
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL</span>
            <span>{formatARS(totalCosto)}</span>
          </div>
        </div>
      )}

      {/* ══ OBSERVACIONES ══ */}
      {remito.observaciones && (
        <div className="border-t border-dashed border-gray-300 pt-2 mb-3">
          <p className="text-gray-500 mb-0.5">Observaciones</p>
          <p className="text-gray-700 whitespace-pre-wrap">{remito.observaciones}</p>
        </div>
      )}

      {/* ══ PIE ══ */}
      <div className="border-t border-dashed border-gray-300 pt-2 text-center text-[10px] text-gray-400 space-y-0.5">
        <p>{remito.numero} · {formatFecha(remito.fecha)}</p>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PrintRemitoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [remito, setRemito] = useState<RemitoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formato, setFormato] = useState<Formato>('a4')

  useEffect(() => {
    fetch(`/api/dashboard/stock/remitos/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data?.error) { setError(data.error); setLoading(false); return }
        setRemito(data)
        setLoading(false)
      })
      .catch(() => { setError('Error al cargar el remito'); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !remito) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600">
        {error || 'Remito no encontrado'}
      </div>
    )
  }

  return (
    <>
      {/* Barra de acción — solo visible en pantalla */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-6 py-3 bg-gray-900 text-white shadow-lg">
        <span className="text-sm font-medium mr-2">Vista de impresión — {remito.numero}</span>

        <div className="flex rounded-lg overflow-hidden border border-gray-600 text-sm">
          <button
            onClick={() => setFormato('a4')}
            className={`px-3 py-1.5 transition-colors ${formato === 'a4' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            A4
          </button>
          <button
            onClick={() => setFormato('ticket')}
            className={`px-3 py-1.5 transition-colors ${formato === 'ticket' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            Ticket 80 mm
          </button>
        </div>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => window.close()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            <X className="w-4 h-4" /> Cerrar
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-500 transition-colors font-medium"
          >
            <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
          </button>
        </div>
      </div>

      {/* Documento */}
      <div className="print:pt-0 pt-16 bg-white min-h-screen">
        {formato === 'a4'
          ? <LayoutA4 remito={remito} />
          : <LayoutTicket remito={remito} />
        }
      </div>

      <style>{`
        @media print {
          @page { size: ${formato === 'a4' ? 'A4' : '80mm auto'}; margin: ${formato === 'a4' ? '12mm 15mm' : '4mm 3mm'}; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}
