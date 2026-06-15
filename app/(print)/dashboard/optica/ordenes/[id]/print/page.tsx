'use client'

import { useEffect, useRef, useState, use } from 'react'
import { Printer, X } from 'lucide-react'
import JsBarcode from 'jsbarcode'
import {
  ESTADO_OPTICA_LABELS, METODO_OPTICA_LABELS, TIPO_ITEM_LABELS, USO_ITEM_LABELS,
  type OpticaOrden,
} from '@/types/optica'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmt(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  return v > 0 ? `+${v}` : String(v)
}

function hasGraduacion(o: OpticaOrden) {
  return [o.lejos_od_esfera, o.lejos_oi_esfera, o.cerca_od_esfera, o.cerca_oi_esfera, o.adicion].some(v => v !== null)
}

// ── Barcode component ─────────────────────────────────────────────────────────

function Barcode({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (svgRef.current && value) {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        width: 2,
        height: 48,
        displayValue: true,
        fontSize: 11,
        margin: 0,
        background: 'transparent',
      })
    }
  }, [value])
  return <svg ref={svgRef} />
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PrintOrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [orden, setOrden] = useState<OpticaOrden | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/dashboard/optica/ordenes/${id}`)
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

  const items = orden.optica_orden_items ?? []
  const tareas = orden.optica_orden_tareas ?? []
  const pagos = orden.optica_orden_pagos ?? []
  const pagado = pagos.filter(p => p.monto > 0).reduce((a, p) => a + p.monto, 0)
  const saldo = orden.total - pagado
  const medicoDisplay = orden.optica_medicos?.nombre ?? orden.medico_nombre

  return (
    <>
      {/* Barra de acción — solo visible en pantalla */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-gray-900 text-white shadow-lg">
        <span className="text-sm font-medium">Vista de impresión — {orden.numero}</span>
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
            {/* Logo */}
            <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={orden.sucursales?.logo_url || '/logos/logo blanco.png'}
                alt="Logo"
                className="w-14 h-14 object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>

            {/* Código de barras + número de orden */}
            <div className="shrink-0">
              <Barcode value={orden.numero} />
            </div>

            {/* Separador */}
            <div className="w-px self-stretch bg-gray-200 mx-1 shrink-0" />

            {/* Datos del cliente + total */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900 leading-tight truncate">{orden.clientes?.nombre ?? 'Sin cliente'}</p>
                  {orden.clientes?.telefono && <p className="text-xs text-gray-500 mt-0.5">{orden.clientes.telefono}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono font-bold text-gray-700 text-sm">{orden.numero}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatFecha(orden.fecha)}</p>
                </div>
              </div>
              <div className="flex items-baseline gap-4 mt-2">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">Total</span>
                  <p className="text-base font-bold text-blue-700 leading-tight">{formatARS(orden.total)}</p>
                </div>
                {saldo > 0.005 && (
                  <>
                    <div className="w-px h-8 bg-gray-200 self-stretch" />
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">Saldo pendiente</span>
                      <p className="text-base font-bold text-red-600 leading-tight">{formatARS(saldo)}</p>
                    </div>
                  </>
                )}
                {saldo <= 0.005 && (
                  <>
                    <div className="w-px h-8 bg-gray-200 self-stretch" />
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">Saldo</span>
                      <p className="text-base font-bold text-green-600 leading-tight">Cancelado</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ══ (bloque de número/barras fusionado en el encabezado) ══ */}
          {/* ══ DATOS DEL CLIENTE Y MÉDICO ══ */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Paciente</p>
              <p className="text-sm font-semibold">{orden.clientes?.nombre ?? '—'}</p>
              {orden.clientes?.telefono && <p className="text-xs text-gray-500 mt-0.5">{orden.clientes.telefono}</p>}
              {orden.vendedores?.nombre && (
                <p className="text-xs text-gray-500 mt-1">Vendedor: <span className="font-medium text-gray-700">{orden.vendedores.nombre}</span></p>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Médico / Receta</p>
              <p className="text-sm font-semibold">{medicoDisplay ?? '—'}</p>
              {orden.optica_medicos?.matricula && (
                <p className="text-xs text-gray-500 mt-0.5">Mat. {orden.optica_medicos.matricula}</p>
              )}
              {orden.receta_url && (
                <p className="text-xs text-blue-600 mt-0.5">Receta adjunta en sistema</p>
              )}
            </div>
          </div>

          {/* ══ GRADUACIÓN ══ */}
          {hasGraduacion(orden) && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Mediciones / Receta</p>
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 w-24"></th>
                    <th className="text-center px-2 py-2 font-semibold text-gray-600">Esfera</th>
                    <th className="text-center px-2 py-2 font-semibold text-gray-600">Cilindro</th>
                    <th className="text-center px-2 py-2 font-semibold text-gray-600">Eje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { label: 'Lejos OD', esf: orden.lejos_od_esfera, cil: orden.lejos_od_cilindro, eje: orden.lejos_od_eje },
                    { label: 'Lejos OI', esf: orden.lejos_oi_esfera, cil: orden.lejos_oi_cilindro, eje: orden.lejos_oi_eje },
                    { label: 'Cerca OD', esf: orden.cerca_od_esfera, cil: orden.cerca_od_cilindro, eje: orden.cerca_od_eje },
                    { label: 'Cerca OI', esf: orden.cerca_oi_esfera, cil: orden.cerca_oi_cilindro, eje: orden.cerca_oi_eje },
                  ].filter(r => r.esf !== null || r.cil !== null).map(row => (
                    <tr key={row.label}>
                      <td className="px-3 py-1.5 font-semibold text-gray-700">{row.label}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{fmt(row.esf)}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{fmt(row.cil)}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{row.eje ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(orden.adicion !== null || orden.dp !== null) && (
                <div className="flex gap-6 mt-2 px-1 text-xs">
                  {orden.adicion !== null && (
                    <span><span className="text-gray-500">Adición:</span> <span className="font-mono font-semibold">{fmt(orden.adicion)}</span></span>
                  )}
                  {orden.dp !== null && (
                    <span><span className="text-gray-500">DP:</span> <span className="font-mono font-semibold">{orden.dp} mm</span></span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ ARTÍCULOS ══ */}
          {items.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Artículos</p>
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Artículo</th>
                    <th className="text-left px-2 py-2 font-semibold text-gray-600">Tipo / Uso</th>
                    <th className="text-center px-2 py-2 font-semibold text-gray-600">Cant.</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600">P. Unit.</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium">
                        {item.nombre}
                        {item.armazon_propio && <span className="ml-1 text-gray-400 font-normal">(propio)</span>}
                        {item.notas && <span className="block text-gray-400 font-normal">{item.notas}</span>}
                      </td>
                      <td className="px-2 py-2 text-gray-500">
                        {TIPO_ITEM_LABELS[item.tipo]}
                        {item.uso && ` · ${USO_ITEM_LABELS[item.uso]}`}
                      </td>
                      <td className="px-2 py-2 text-center">{item.cantidad}</td>
                      <td className="px-2 py-2 text-right">
                        {item.armazon_propio ? '—' : formatARS(item.precio_unitario)}
                        {item.descuento_pct > 0 && (
                          <span className="block text-gray-400">-{item.descuento_pct}%</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {item.armazon_propio ? '—' : formatARS(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ══ VALORES / TOTALES ══ */}
          <div className="mb-5 flex justify-end">
            <div className="w-64 space-y-1 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal artículos</span>
                <span>{formatARS(orden.subtotal)}</span>
              </div>
              {orden.costo_trabajo > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Costo de trabajo</span>
                  <span>{formatARS(orden.costo_trabajo)}</span>
                </div>
              )}
              {(orden.descuento_pct > 0 || orden.descuento_monto > 0) && (
                <div className="flex justify-between text-gray-500">
                  <span>Descuento{orden.descuento_pct > 0 ? ` (${orden.descuento_pct}%)` : ''}</span>
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

              {/* Resumen de saldo */}
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
          {orden.observaciones && (
            <div className="mb-5 border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Observaciones</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{orden.observaciones}</p>
            </div>
          )}

          {/* ══ PIE DE PÁGINA ══ */}
          <div className="border-t border-gray-200 pt-3 text-center text-xs text-gray-400">
            <p>Orden {orden.numero} · Emitida el {new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
          </div>

        </div>
      </div>

      {/* Estilos de impresión */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}
