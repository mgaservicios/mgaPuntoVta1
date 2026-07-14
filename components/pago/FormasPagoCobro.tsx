'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import type { FormaPago } from '@/types/formas-pago'
import { TIPOS_CON_REFERENCIA } from '@/types/formas-pago'
import type { NotaCredito } from '@/types/notas-credito'

/* ── Tipo de salida ─────────────────────────────────────────────────────────── */

export interface PagoFormData {
  metodo: string
  monto: string
  concepto: string
  referencia: string
  fecha_pago: string
  forma_pago_id: number | null
  cuotas: number | null
  recargo_monto: number
  nota_credito_id: number | null
}

/* ── Props ──────────────────────────────────────────────────────────────────── */

interface FormasPagoCobroProps {
  saldo: number
  clienteId?: number | null
  showConcepto?: boolean
  defaultValue?: Partial<PagoFormData>
  ncsDisponibles?: NotaCredito[]
  saldoCC?: number | null
  onChange: (data: PagoFormData) => void
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

/* ── Componente ─────────────────────────────────────────────────────────────── */

export default function FormasPagoCobro({
  saldo,
  clienteId,
  showConcepto = false,
  defaultValue,
  ncsDisponibles = [],
  saldoCC = null,
  onChange,
}: FormasPagoCobroProps) {
  const [formasPago, setFormasPago] = useState<FormaPago[]>([])
  const [metodo, setMetodo] = useState(defaultValue?.metodo ?? '')
  const [monto, setMonto] = useState(defaultValue?.monto ?? '')
  const [concepto, setConcepto] = useState(defaultValue?.concepto ?? 'PAGO')
  const [referencia, setReferencia] = useState(defaultValue?.referencia ?? '')
  const [fechaPago, setFechaPago] = useState(defaultValue?.fecha_pago ?? new Date().toISOString().slice(0, 10))
  const [formaPagoId, setFormaPagoId] = useState<number | null>(defaultValue?.forma_pago_id ?? null)
  const [cuotas, setCuotas] = useState<number | null>(defaultValue?.cuotas ?? null)
  const [recargoMonto, setRecargoMonto] = useState(defaultValue?.recargo_monto ?? 0)
  const [notaCreditoId, setNotaCreditoId] = useState<number | null>(defaultValue?.nota_credito_id ?? null)

  /* Fetch formas de pago al montar */
  useEffect(() => {
    fetch('/api/dashboard/formas-pago')
      .then(r => r.json())
      .then(data => {
        const fps: FormaPago[] = Array.isArray(data) ? data : []
        setFormasPago(fps)
        if (!metodo && fps[0]) {
          setMetodo(fps[0].nombre)
          setFormaPagoId(fps[0].id)
          if (!monto) setMonto(saldo > 0 ? saldo.toFixed(2) : '0')
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Emitir datos al padre en cada cambio */
  useEffect(() => {
    onChange({
      metodo,
      monto,
      concepto,
      referencia,
      fecha_pago: fechaPago,
      forma_pago_id: formaPagoId,
      cuotas,
      recargo_monto: recargoMonto,
      nota_credito_id: notaCreditoId,
    })
  }, [metodo, monto, concepto, referencia, fechaPago, formaPagoId, cuotas, recargoMonto, notaCreditoId, onChange])

  /* Forma pago actual */
  const fp = formasPago.find(f => f.nombre === metodo)
  const esCuentaCorriente = metodo === 'CUENTA_CORRIENTE'
  const esNotaCredito = metodo === 'NOTA_CREDITO'
  const mostrarRefFecha = fp != null && TIPOS_CON_REFERENCIA.includes(fp.tipo)
  const mostrarCuotas = fp?.tipo === 'TARJETA_CREDITO' && (fp.formas_pago_cuotas?.length ?? 0) > 0

  /* ── Handlers ───────────────────────────────────────────────────────────── */

  function handleMetodoChange(value: string) {
    const newFp = formasPago.find(f => f.nombre === value)
    setMetodo(value)
    setFormaPagoId(newFp?.id ?? null)
    setCuotas(null)
    setNotaCreditoId(null)
    setReferencia('')
    setRecargoMonto(0)
    setMonto(saldo > 0 ? saldo.toFixed(2) : '0')
  }

  function handleCuotasChange(cuotaNum: number | null) {
    setCuotas(cuotaNum)
    if (cuotaNum && fp) {
      const cuota = fp.formas_pago_cuotas?.find(c => c.cantidad_cuotas === cuotaNum)
      if (cuota) {
        const rm = Math.round(saldo * cuota.recargo_pct / 100 * 100) / 100
        setRecargoMonto(rm)
        setMonto((saldo + rm).toFixed(2))
      }
    } else {
      setRecargoMonto(0)
      setMonto(saldo > 0 ? saldo.toFixed(2) : '0')
    }
  }

  function handleNcChange(ncId: string) {
    const nc = ncsDisponibles.find(n => String(n.id) === ncId)
    if (!nc) {
      setNotaCreditoId(null)
      setMonto(saldo > 0 ? saldo.toFixed(2) : '0')
      return
    }
    setNotaCreditoId(nc.id)
    setMonto(Math.min(nc.monto_disponible, saldo).toFixed(2))
  }

  function applyCC() {
    if (saldoCC === null) return
    const aplicar = Math.min(Math.abs(saldoCC), saldo)
    setMetodo('CUENTA_CORRIENTE')
    setFormaPagoId(null)
    setCuotas(null)
    setRecargoMonto(0)
    setMonto(aplicar.toFixed(2))
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */

  const totalConRecargo = Math.round((saldo + recargoMonto) * 100) / 100

  return (
    <div className="space-y-2.5">
      {/* Banner saldo CC */}
      {saldoCC !== null && saldoCC < -0.001 && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
          <p className="text-xs text-green-800">
            <span className="font-semibold">Saldo a favor en CC:</span> {formatARS(Math.abs(saldoCC))}
          </p>
          <button
            type="button"
            className="text-xs text-green-700 font-medium underline hover:no-underline ml-2"
            onClick={applyCC}
          >
            Aplicar
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Método */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-16 text-right shrink-0">Método</span>
          <select
            className="h-8 text-sm border border-input rounded-md px-2 bg-white flex-1"
            value={metodo}
            onChange={e => handleMetodoChange(e.target.value)}
          >
            {formasPago.map(f => <option key={f.id} value={f.nombre}>{f.nombre}</option>)}
            <option value="CUENTA_CORRIENTE">Cuenta corriente</option>
            <option value="NOTA_CREDITO">Nota de crédito</option>
          </select>
        </div>

        {/* Monto */}
        {!esNotaCredito && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16 text-right shrink-0">Monto</span>
            <Input
              type="number" placeholder="0.00" className="h-8 text-sm flex-1"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              min="0"
            />
          </div>
        )}

        {/* Concepto */}
        {showConcepto && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16 text-right shrink-0">Concepto</span>
            <Input
              placeholder="SEÑA, SALDO..."
              className="h-8 text-sm flex-1"
              value={concepto}
              onChange={e => setConcepto(e.target.value)}
            />
          </div>
        )}

        {/* Referencia + Fecha */}
        {mostrarRefFecha && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16 text-right shrink-0">Referencia</span>
              <Input
                placeholder="N° transf..."
                className="h-8 text-sm flex-1"
                value={referencia}
                onChange={e => setReferencia(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 col-span-2">
              <span className="text-xs text-gray-500 w-16 text-right shrink-0">Fecha</span>
              <Input
                type="date"
                className="h-8 text-sm w-36"
                value={fechaPago || new Date().toISOString().slice(0, 10)}
                onChange={e => setFechaPago(e.target.value)}
              />
            </div>
          </>
        )}

        {/* Cuotas (solo TARJETA_CREDITO) */}
        {mostrarCuotas && (
          <div className="flex items-center gap-2 col-span-2">
            <span className="text-xs text-gray-500 w-16 text-right shrink-0">Cuotas</span>
            <select
              className="h-8 text-sm border border-input rounded-md px-2 bg-white"
              value={cuotas ?? ''}
              onChange={e => handleCuotasChange(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">Sin cuotas</option>
              {fp!.formas_pago_cuotas
                .sort((a, b) => a.cantidad_cuotas - b.cantidad_cuotas)
                .map(c => (
                  <option key={c.id} value={c.cantidad_cuotas}>
                    {c.cantidad_cuotas}x {c.recargo_pct > 0 ? `(+${c.recargo_pct}% rec.)` : 'sin recargo'}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* NC selector */}
        {esNotaCredito && (
          <div className="col-span-2">
            {!clienteId ? (
              <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                Seleccioná un cliente para ver sus NCs
              </p>
            ) : ncsDisponibles.length === 0 ? (
              <p className="text-xs text-gray-400 bg-gray-50 rounded px-2 py-1">
                El cliente no tiene notas de crédito disponibles
              </p>
            ) : (
              <select
                className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white"
                value={notaCreditoId ? String(notaCreditoId) : ''}
                onChange={e => handleNcChange(e.target.value)}
              >
                <option value="">Seleccioná una nota de crédito…</option>
                {ncsDisponibles.map(nc => (
                  <option key={nc.id} value={String(nc.id)}>
                    {nc.numero} — {formatARS(nc.monto_disponible)} disp.
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Display recargo sobre saldo */}
      {recargoMonto > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm space-y-1">
          <div className="flex justify-between text-amber-800">
            <span>Saldo pendiente:</span>
            <span>{formatARS(saldo)}</span>
          </div>
          <div className="flex justify-between text-amber-800">
            <span>+ Recargo ({cuotas}x):</span>
            <span>{formatARS(recargoMonto)}</span>
          </div>
          <div className="flex justify-between font-bold text-amber-900 border-t border-amber-200 pt-1">
            <span>Total a pagar:</span>
            <span>{formatARS(totalConRecargo)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
