'use client'

import { useEffect, useRef, useState, use } from 'react'
import { Printer, X } from 'lucide-react'
import JsBarcode from 'jsbarcode'
import {
  CONDICION_LABELS, METODO_ORDEN_LABELS,
  type OrdenVenta,
} from '@/types/ordenes'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type Formato = 'a4' | 'ticket'

// ── Barcode component ─────────────────────────────────────────────────────────

function Barcode({ value, width = 2, height = 48 }: { value: string; width?: number; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (svgRef.current && value) {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width,
        height,
        displayValue: true,
        fontSize: 11,
        margin: 0,
        background: 'transparent',
      })
    }
  }, [value, width, height])
  return <svg ref={svgRef} />
}

// ── Logo ──────────────────────────────────────────────────────────────────────

function Logo({ size = 16, url }: { size?: number; url?: string | null }) {
  const cls = `w-${size} h-${size}`
  return (
    <div className={`${cls} bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0`}>
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

// ── Leyenda fiscal ─────────────────────────────────────────────────────────────

function LeyendaFiscal({ className = '' }: { className?: string }) {
  return (
    <span className={`text-[10px] font-bold tracking-widest uppercase text-gray-500 border border-gray-400 rounded px-2 py-0.5 ${className}`}>
      Comprobante sin validez fiscal
    </span>
  )
}

// ── Layout A4 ─────────────────────────────────────────────────────────────────

function LayoutA4({ orden, logoUrl }: { orden: OrdenVenta; logoUrl?: string | null }) {
  const items = orden.orden_venta_items ?? []
  const pagos = orden.orden_venta_pagos ?? []
  const totalPagado = pagos.reduce((a, p) => a + p.monto, 0)
  const saldo = orden.total - totalPagado

  return (
    <div className="max-w-[210mm] mx-auto px-8 py-6 print:px-6 print:py-4 text-gray-900">

      {/* ══ ENCABEZADO ══ */}
      <div className="flex items-center gap-4 border-b-2 border-gray-800 pb-4 mb-5">
        <Logo size={16} url={logoUrl} />

        <div className="shrink-0">
          <Barcode value={orden.numero} width={1.8} height={44} />
        </div>

        <div className="w-px self-stretch bg-gray-200 mx-1 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-bold text-gray-900 leading-tight truncate">
                {orden.clientes?.nombre ?? 'Consumidor final'}
              </p>
              {orden.clientes?.telefono && (
                <p className="text-xs text-gray-500 mt-0.5">{orden.clientes.telefono}</p>
              )}
              <LeyendaFiscal className="mt-1 inline-block" />
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono font-bold text-gray-700 text-sm">{orden.numero}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatFecha(orden.fecha)}</p>
              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded mt-1 inline-block ${
                orden.estado === 'confirmada' ? 'bg-blue-100 text-blue-700'
                : orden.estado === 'anulada' ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600'
              }`}>
                {orden.estado === 'confirmada' ? 'Confirmada' : orden.estado === 'anulada' ? 'Anulada' : 'Borrador'}
              </span>
            </div>
          </div>
          <p className="text-lg font-bold text-blue-700 mt-2">{formatARS(orden.total)}</p>
        </div>
      </div>

      {/* ══ DATOS DE LA ORDEN ══ */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Condición de pago</p>
          <p className="text-sm font-semibold">{CONDICION_LABELS[orden.condicion_pago]}</p>
        </div>
        {orden.vencimiento && (
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Vencimiento</p>
            <p className="text-sm font-semibold">{formatFecha(orden.vencimiento)}</p>
          </div>
        )}
        {orden.vendedores?.nombre && (
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Vendedor</p>
            <p className="text-sm font-semibold">{orden.vendedores.nombre}</p>
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
              <th className="text-center px-2 py-2 font-semibold text-gray-600 w-16">Cant.</th>
              <th className="text-right px-2 py-2 font-semibold text-gray-600 w-24">P. Unit.</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-600 w-24">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-3 py-2 font-medium">
                  {item.nombre_articulo}
                  {item.descripcion_variante && (
                    <span className="block text-gray-400 font-normal">{item.descripcion_variante}</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">{Number(item.cantidad).toLocaleString('es-AR')}</td>
                <td className="px-2 py-2 text-right">
                  {formatARS(item.precio_unitario)}
                  {item.descuento_pct > 0 && (
                    <span className="block text-gray-400">-{item.descuento_pct}%</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-medium">{formatARS(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ══ TOTALES + PAGOS ══ */}
      <div className="flex gap-6 mb-5">

        {/* Pagos */}
        {pagos.length > 0 && (
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pagos registrados</p>
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Método</th>
                  {pagos.some(p => p.fecha_pago) && (
                    <th className="text-left px-2 py-2 font-semibold text-gray-600">Fecha</th>
                  )}
                  {pagos.some(p => p.referencia) && (
                    <th className="text-left px-2 py-2 font-semibold text-gray-600">Referencia</th>
                  )}
                  <th className="text-right px-3 py-2 font-semibold text-gray-600">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagos.map(p => (
                  <tr key={p.id}>
                    <td className="px-3 py-1.5 text-gray-600">{METODO_ORDEN_LABELS[p.metodo]}</td>
                    {pagos.some(p2 => p2.fecha_pago) && (
                      <td className="px-2 py-1.5 text-gray-500">{p.fecha_pago ? formatFecha(p.fecha_pago) : '—'}</td>
                    )}
                    {pagos.some(p2 => p2.referencia) && (
                      <td className="px-2 py-1.5 text-gray-500">{p.referencia ?? '—'}</td>
                    )}
                    <td className="px-3 py-1.5 text-right font-medium">{formatARS(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mt-2 gap-8 text-xs">
              <div className="flex justify-between gap-4 text-gray-500">
                <span>Total pagado:</span>
                <span className="font-medium text-green-600">{formatARS(totalPagado)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className={saldo > 0.005 ? 'text-red-600 font-semibold' : 'text-gray-500'}>Saldo:</span>
                <span className={`font-semibold ${saldo > 0.005 ? 'text-red-600' : 'text-green-600'}`}>{formatARS(saldo)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Totales */}
        <div className="w-56">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Totales</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{formatARS(orden.subtotal)}</span>
            </div>
            {orden.descuento_monto > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Descuento ({orden.descuento_pct}%)</span>
                <span className="text-red-600">-{formatARS(orden.descuento_monto)}</span>
              </div>
            )}
            {(orden as unknown as { recargo_monto?: number }).recargo_monto! > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Recargo</span>
                <span className="text-amber-600">+{formatARS((orden as unknown as { recargo_monto: number }).recargo_monto)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm border-t border-gray-200 pt-1.5">
              <span>TOTAL</span>
              <span>{formatARS(orden.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ OBSERVACIONES ══ */}
      {orden.observaciones && (
        <div className="mb-5 border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Observaciones</p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{orden.observaciones}</p>
        </div>
      )}

      {/* ══ PIE ══ */}
      <div className="border-t border-gray-200 pt-3 text-center text-xs text-gray-400">
        <p>Orden {orden.numero} · Emitida el {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
      </div>
    </div>
  )
}

// ── Layout Ticket 80mm ────────────────────────────────────────────────────────

function LayoutTicket({ orden, logoUrl }: { orden: OrdenVenta; logoUrl?: string | null }) {
  const items = orden.orden_venta_items ?? []
  const pagos = orden.orden_venta_pagos ?? []
  const totalPagado = pagos.reduce((a, p) => a + p.monto, 0)
  const saldo = orden.total - totalPagado

  return (
    <div className="max-w-[80mm] mx-auto px-4 py-6 print:px-3 print:py-3 text-gray-900 text-xs">

      {/* ══ ENCABEZADO ══ */}
      <div className="flex flex-col items-center gap-2 border-b-2 border-gray-800 pb-3 mb-3">
        <Logo size={14} url={logoUrl} />
        <LeyendaFiscal />
        <Barcode value={orden.numero} width={1.6} height={38} />
        <div className="text-center">
          <p className="font-bold text-sm font-mono">{orden.numero}</p>
          <p className="text-gray-500 text-[11px]">{formatFecha(orden.fecha)}</p>
        </div>
      </div>

      {/* ══ CLIENTE + CONDICIÓN ══ */}
      <div className="mb-3 space-y-1">
        <div>
          <span className="text-gray-500">Cliente: </span>
          <span className="font-medium">{orden.clientes?.nombre ?? 'Consumidor final'}</span>
        </div>
        <div>
          <span className="text-gray-500">Condición: </span>
          <span className="font-medium">{CONDICION_LABELS[orden.condicion_pago]}</span>
        </div>
        {orden.vencimiento && (
          <div>
            <span className="text-gray-500">Vence: </span>
            <span className="font-medium">{formatFecha(orden.vencimiento)}</span>
          </div>
        )}
        {orden.vendedores?.nombre && (
          <div>
            <span className="text-gray-500">Vendedor: </span>
            <span className="font-medium">{orden.vendedores.nombre}</span>
          </div>
        )}
      </div>

      {/* ══ ARTÍCULOS ══ */}
      <div className="mb-3">
        <div className="flex justify-between font-semibold text-gray-600 border-b border-dashed border-gray-300 pb-1 mb-2">
          <span>Artículo</span>
          <span>Importe</span>
        </div>
        {items.map(item => {
          const lineTotal = item.cantidad * item.precio_unitario * (1 - item.descuento_pct / 100)
          return (
            <div key={item.id} className="mb-2">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{item.nombre_articulo}</p>
                  {item.descripcion_variante && (
                    <p className="text-gray-400 text-[10px]">{item.descripcion_variante}</p>
                  )}
                  <p className="text-gray-500 text-[10px]">
                    {Number(item.cantidad).toLocaleString('es-AR')} × {formatARS(item.precio_unitario)}
                    {item.descuento_pct > 0 && ` (−${item.descuento_pct}%)`}
                  </p>
                </div>
                <span className="font-medium shrink-0">{formatARS(lineTotal)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ══ TOTALES ══ */}
      <div className="border-t border-dashed border-gray-300 pt-2 mb-3 space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Subtotal</span>
          <span>{formatARS(orden.subtotal)}</span>
        </div>
        {orden.descuento_monto > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">Descuento ({orden.descuento_pct}%)</span>
            <span className="text-red-600">−{formatARS(orden.descuento_monto)}</span>
          </div>
        )}
        {(orden as unknown as { recargo_monto?: number }).recargo_monto! > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">Recargo</span>
            <span className="text-amber-600">+{formatARS((orden as unknown as { recargo_monto: number }).recargo_monto)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm border-t border-gray-300 pt-1 mt-1">
          <span>TOTAL</span>
          <span>{formatARS(orden.total)}</span>
        </div>
      </div>

      {/* ══ PAGOS ══ */}
      {pagos.length > 0 && (
        <div className="mb-3 space-y-1">
          <p className="text-gray-500 font-semibold mb-1">Pagos registrados</p>
          {pagos.map(p => (
            <div key={p.id} className="flex justify-between">
              <span className="text-gray-600">{METODO_ORDEN_LABELS[p.metodo]}</span>
              <span>{formatARS(p.monto)}</span>
            </div>
          ))}
          <div className="border-t border-dashed border-gray-300 pt-1 mt-1 space-y-1">
            <div className="flex justify-between text-green-700 font-medium">
              <span>Total pagado</span>
              <span>{formatARS(totalPagado)}</span>
            </div>
            <div className={`flex justify-between font-semibold ${saldo > 0.005 ? 'text-red-600' : 'text-green-600'}`}>
              <span>Saldo</span>
              <span>{formatARS(saldo)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ══ OBSERVACIONES ══ */}
      {orden.observaciones && (
        <div className="border-t border-dashed border-gray-300 pt-2 mb-3">
          <p className="text-gray-500 mb-0.5">Observaciones</p>
          <p className="text-gray-700 whitespace-pre-wrap">{orden.observaciones}</p>
        </div>
      )}

      {/* ══ PIE ══ */}
      <div className="border-t border-dashed border-gray-300 pt-2 text-center text-[10px] text-gray-400 space-y-0.5">
        <p>{orden.numero} · {formatFecha(orden.fecha)}</p>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PrintOrdenVentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [orden, setOrden] = useState<OrdenVenta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formato, setFormato] = useState<Formato>('a4')

  useEffect(() => {
    fetch(`/api/dashboard/ordenes/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data?.error) { setError(data.error); setLoading(false); return }
        setOrden(data)
        setLoading(false)
      })
      .catch(() => { setError('Error al cargar la orden'); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !orden) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600">
        {error || 'Orden no encontrada'}
      </div>
    )
  }

  return (
    <>
      {/* Barra de acción — solo visible en pantalla */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-6 py-3 bg-gray-900 text-white shadow-lg">
        <span className="text-sm font-medium mr-2">Vista de impresión — {orden.numero}</span>

        {/* Selector de formato */}
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

      {/* Documento */}
      <div className="print:pt-0 pt-16 bg-white min-h-screen">
        {formato === 'a4'
          ? <LayoutA4 orden={orden} logoUrl={orden.sucursales?.logo_url} />
          : <LayoutTicket orden={orden} logoUrl={orden.sucursales?.logo_url} />}
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
