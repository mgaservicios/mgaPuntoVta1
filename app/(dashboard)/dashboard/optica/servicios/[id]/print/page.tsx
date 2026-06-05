'use client'

import { useEffect, useRef, useState, use } from 'react'
import { Printer, X } from 'lucide-react'
import JsBarcode from 'jsbarcode'
import {
  ESTADO_SERVICIO_LABELS, METODO_OPTICA_LABELS, TIPO_SERVICIO_LABELS,
  ESTADO_TIPO_SERVICIO_LABELS,
  type OpticaServicio, type EstadoTipoServicio,
} from '@/types/optica'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Barcode ───────────────────────────────────────────────────────────────────

function Barcode({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (svgRef.current && value) {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128', width: 2, height: 48,
        displayValue: true, fontSize: 11, margin: 0, background: 'transparent',
      })
    }
  }, [value])
  return <svg ref={svgRef} />
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PrintServicioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }     = use(params)
  const [servicio, setServicio] = useState<OpticaServicio | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    fetch(`/api/dashboard/optica/servicios/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data?.error) { setError(data.error); setLoading(false); return }
        setServicio(data)
        setLoading(false)
      })
      .catch(() => { setError('Error al cargar el servicio'); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !servicio) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600">
        {error || 'Servicio no encontrado'}
      </div>
    )
  }

  const tipos  = servicio.optica_servicio_tipos ?? []
  const pagos  = servicio.optica_servicio_pagos ?? []
  const pagado = pagos.filter(p => p.monto > 0).reduce((a, p) => a + p.monto, 0)
  const saldo  = servicio.total - pagado

  return (
    <>
      {/* Barra de acción — solo visible en pantalla */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-gray-900 text-white shadow-lg">
        <span className="text-sm font-medium">Vista de impresión — {servicio.numero}</span>
        <div className="flex gap-2">
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

      {/* Documento imprimible */}
      <div className="print:pt-0 pt-16 bg-white min-h-screen">
        <div className="max-w-[210mm] mx-auto px-8 py-6 print:px-6 print:py-4 text-gray-900">

          {/* ══ ENCABEZADO ══ */}
          <div className="flex items-center gap-4 border-b-2 border-gray-800 pb-4 mb-5">
            <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/logo blanco.png"
                alt="Logo"
                className="w-14 h-14 object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>

            <div className="shrink-0">
              <Barcode value={servicio.numero} />
            </div>

            <div className="w-px self-stretch bg-gray-200 mx-1 shrink-0" />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900 leading-tight truncate">
                    {servicio.clientes?.nombre ?? 'Sin cliente'}
                  </p>
                  {servicio.clientes?.telefono && (
                    <p className="text-xs text-gray-500 mt-0.5">{servicio.clientes.telefono}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono font-bold text-gray-700 text-sm">{servicio.numero}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatFecha(servicio.fecha)}</p>
                  {servicio.fecha_prometida && (
                    <p className="text-xs text-gray-500">Prometido: {formatFecha(servicio.fecha_prometida)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-baseline gap-4 mt-2">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">Total</span>
                  <p className="text-base font-bold text-blue-700 leading-tight">{formatARS(servicio.total)}</p>
                </div>
                {saldo > 0.005 ? (
                  <>
                    <div className="w-px h-8 bg-gray-200 self-stretch" />
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">Saldo pendiente</span>
                      <p className="text-base font-bold text-red-600 leading-tight">{formatARS(saldo)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-px h-8 bg-gray-200 self-stretch" />
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">Saldo</span>
                      <p className="text-base font-bold text-green-600 leading-tight">Cancelado</p>
                    </div>
                  </>
                )}
                <div className="w-px h-8 bg-gray-200 self-stretch" />
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">Estado</span>
                  <p className="text-xs font-semibold text-gray-700 leading-tight">{ESTADO_SERVICIO_LABELS[servicio.estado]}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ══ DATOS DEL CLIENTE ══ */}
          <div className="border border-gray-200 rounded-lg p-3 mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Cliente</p>
            <p className="text-sm font-semibold">{servicio.clientes?.nombre ?? '—'}</p>
            {servicio.clientes?.telefono && (
              <p className="text-xs text-gray-500 mt-0.5">{servicio.clientes.telefono}</p>
            )}
          </div>

          {/* ══ DETALLE DEL TRABAJO ══ */}
          {servicio.detalle && (
            <div className="mb-5 border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Detalle del trabajo</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{servicio.detalle}</p>
            </div>
          )}

          {/* ══ TIPOS DE REPARACIÓN ══ */}
          {tipos.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tipos de reparación</p>
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Tipo</th>
                    <th className="text-left px-2 py-2 font-semibold text-gray-600">Detalle / Descripción</th>
                    <th className="text-center px-2 py-2 font-semibold text-gray-600">Estado</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tipos.map(t => (
                    <tr key={t.id}>
                      <td className="px-3 py-2 font-medium">
                        {TIPO_SERVICIO_LABELS[t.tipo as keyof typeof TIPO_SERVICIO_LABELS]}
                      </td>
                      <td className="px-2 py-2 text-gray-500">{t.detalle ?? '—'}</td>
                      <td className="px-2 py-2 text-center">
                        <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                          t.estado === 'terminado' ? 'bg-green-100 text-green-700' :
                          t.estado === 'en_proceso' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {ESTADO_TIPO_SERVICIO_LABELS[t.estado as EstadoTipoServicio] ?? t.estado}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {t.precio > 0 ? formatARS(t.precio) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ══ TOTALES ══ */}
          <div className="mb-5 flex justify-end">
            <div className="w-64 space-y-1 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal reparaciones</span>
                <span>{formatARS(tipos.reduce((a, t) => a + t.precio, 0))}</span>
              </div>
              {servicio.costo_trabajo > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Costo de trabajo</span>
                  <span>{formatARS(servicio.costo_trabajo)}</span>
                </div>
              )}
              {(servicio.descuento_pct > 0 || servicio.descuento_monto > 0) && (
                <div className="flex justify-between text-gray-500">
                  <span>Descuento{servicio.descuento_pct > 0 ? ` (${servicio.descuento_pct}%)` : ''}</span>
                  <span className="text-red-600">-{formatARS(servicio.descuento_monto)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t border-gray-200 pt-1.5">
                <span>TOTAL</span>
                <span>{formatARS(servicio.total)}</span>
              </div>
            </div>
          </div>

          {/* ══ SEÑAS / PAGOS ══ */}
          {pagos.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Señas y pagos</p>
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Fecha</th>
                    <th className="text-left px-2 py-2 font-semibold text-gray-600">Concepto</th>
                    <th className="text-left px-2 py-2 font-semibold text-gray-600">Método</th>
                    {pagos.some(p => p.referencia) && (
                      <th className="text-left px-2 py-2 font-semibold text-gray-600">Referencia</th>
                    )}
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagos.map(p => (
                    <tr key={p.id} className={p.monto < 0 ? 'bg-red-50' : ''}>
                      <td className="px-3 py-1.5 text-gray-600">{formatFecha(p.fecha_pago)}</td>
                      <td className="px-2 py-1.5 text-gray-600">{p.concepto ?? '—'}</td>
                      <td className="px-2 py-1.5 text-gray-600">{METODO_OPTICA_LABELS[p.metodo]}</td>
                      {pagos.some(p2 => p2.referencia) && (
                        <td className="px-2 py-1.5 text-gray-500">{p.referencia ?? '—'}</td>
                      )}
                      <td className={`px-3 py-1.5 text-right font-medium ${p.monto < 0 ? 'text-red-600' : ''}`}>
                        {formatARS(p.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end mt-2">
                <div className="w-64 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>Total pagado</span>
                    <span className="text-green-600 font-medium">{formatARS(pagado)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm border-t border-gray-200 pt-1.5">
                    <span>Saldo pendiente</span>
                    <span className={saldo > 0.005 ? 'text-red-600' : 'text-green-600'}>
                      {formatARS(saldo)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ OBSERVACIONES ══ */}
          {servicio.observaciones && (
            <div className="mb-5 border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Observaciones</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{servicio.observaciones}</p>
            </div>
          )}

          {/* ══ PIE ══ */}
          <div className="border-t border-gray-200 pt-3 text-center text-xs text-gray-400">
            <p>Servicio {servicio.numero} · Emitido el {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
          </div>

        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}
