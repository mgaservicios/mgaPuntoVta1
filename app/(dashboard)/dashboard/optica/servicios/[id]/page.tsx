'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Save, CheckCircle, XCircle, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import {
  ESTADO_SERVICIO_LABELS, ESTADO_SERVICIO_BADGE,
  METODO_OPTICA_LABELS, TIPO_SERVICIO_LABELS, TIPOS_SERVICIO_LIST,
  ESTADO_TIPO_SERVICIO_LABELS, ESTADO_TIPO_SERVICIO_BADGE,
  type OpticaServicio, type OpticaServicioPago,
  type EstadoServicio, type TipoServicio, type MetodoPagoOptica,
  type EstadoTipoServicio,
} from '@/types/optica'
import type { Cliente } from '@/types/clientes'
import ClienteSearch from '@/components/dashboard/ClienteSearch'
import { useSucursalActiva } from '@/hooks/useSucursalActiva'

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface TipoForm {
  key: string
  tipo: TipoServicio
  detalle: string
  precio: string
  estadoItem: EstadoTipoServicio
}

interface PagoForm {
  metodo: MetodoPagoOptica
  monto: string
  concepto: string
  referencia: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const METODOS: MetodoPagoOptica[] = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CUENTA_CORRIENTE', 'CHEQUE', 'OTRO']

const lbl  = 'w-32 shrink-0 text-right text-xs text-gray-500 leading-none pt-[9px]'
const lbl2 = 'w-32 shrink-0 text-right text-xs text-gray-500 leading-none'

// ── Componente principal ──────────────────────────────────────────────────────

export default function OpticaServicioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params)
  const isNueva = id === 'nueva'
  const router  = useRouter()
  const sucursalNombre = useSucursalActiva()

  const [servicio, setServicio] = useState<OpticaServicio | null>(null)
  const [loading, setLoading]   = useState(!isNueva)
  const [saving, setSaving]     = useState(false)
  const [estadoSV, setEstadoSV] = useState<EstadoServicio>('pendiente')

  const [fecha, setFecha]                   = useState(new Date().toISOString().slice(0, 10))
  const [fechaPrometida, setFechaPrometida] = useState('')
  const [cliente, setCliente]               = useState<Cliente | null>(null)
  const [detalle, setDetalle]               = useState('')
  const [observaciones, setObservaciones]   = useState('')

  const [tipos, setTipos]               = useState<TipoForm[]>([])
  const [estadoManual, setEstadoManual] = useState<'pendiente' | 'en_proceso' | 'terminado'>('pendiente')
  const [costoTrabajo, setCostoTrabajo] = useState('0')
  const [descuentoPct, setDescuentoPct]  = useState('0')
  const [descuentoMonto, setDescuentoMonto] = useState('0')
  const [anticipo, setAnticipo]         = useState('0')
  const [anticipoMetodo, setAnticipoMetodo] = useState<MetodoPagoOptica>('EFECTIVO')

  const [pagos, setPagos]               = useState<OpticaServicioPago[]>([])
  const [showPagoForm, setShowPagoForm] = useState(false)
  const [pagoForm, setPagoForm]         = useState<PagoForm>({ metodo: 'EFECTIVO', monto: '', concepto: 'SEÑA', referencia: '' })
  const [savingPago, setSavingPago]     = useState(false)

  const [confirmAnular, setConfirmAnular]     = useState(false)
  const [confirmEntregar, setConfirmEntregar] = useState(false)
  const [confirmImprimirNueva, setConfirmImprimirNueva] = useState<{ id: number; numero: string } | null>(null)

  // terminado ya NO es readonly — los tipos se pueden seguir editando
  const esEntregado  = estadoSV === 'entregado'
  const esAnulado    = estadoSV === 'anulado'
  const esReadonly   = esEntregado || esAnulado
  const disabledEdit = esReadonly

  // ── Cargar servicio ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (isNueva) return
    const load = async () => {
      const res = await fetch(`/api/dashboard/optica/servicios/${id}`)
      if (!res.ok) { toast.error('No se pudo cargar el servicio'); router.push('/dashboard/optica/servicios'); return }
      const data: OpticaServicio = await res.json()
      setServicio(data)
      setEstadoSV(data.estado)
      setFecha(data.fecha)
      setFechaPrometida(data.fecha_prometida ?? '')
      if (data.clientes) {
        setCliente({ id: data.cliente_id!, nombre: data.clientes.nombre, telefono: data.clientes.telefono ?? null } as Cliente)
      }
      setDetalle(data.detalle ?? '')
      setObservaciones(data.observaciones ?? '')
      // estado manual solo aplica cuando no hay tipos
      const estadosValidos = ['pendiente', 'en_proceso', 'terminado'] as const
      if (estadosValidos.includes(data.estado as typeof estadosValidos[number])) {
        setEstadoManual(data.estado as 'pendiente' | 'en_proceso' | 'terminado')
      }
      setTipos((data.optica_servicio_tipos ?? []).map(t => ({
        key:       String(t.id),
        tipo:      t.tipo,
        detalle:   t.detalle ?? '',
        precio:    t.precio.toString(),
        estadoItem: t.estado ?? 'pendiente',
      })))
      setCostoTrabajo(data.costo_trabajo?.toString() ?? '0')
      setDescuentoPct(data.descuento_pct?.toString() ?? '0')
      setDescuentoMonto(data.descuento_monto?.toString() ?? '0')
      setAnticipo(data.anticipo?.toString() ?? '0')
      setPagos(data.optica_servicio_pagos ?? [])
      setLoading(false)
    }
    load()
  }, [id, isNueva, router])

  // ── Cálculos ──────────────────────────────────────────────────────────────────

  const subtotalTipos   = tipos.reduce((acc, t) => acc + Math.max(0, parseFloat(t.precio) || 0), 0)
  const costoTrabajoNum = Math.max(0, parseFloat(costoTrabajo) || 0)
  const subtotal        = Math.round((subtotalTipos + costoTrabajoNum) * 100) / 100
  const descMonto       = Math.min(Math.max(0, parseFloat(descuentoMonto) || 0), subtotal)
  const total           = Math.round((subtotal - descMonto) * 100) / 100
  const anticipoNum     = Math.max(0, parseFloat(anticipo) || 0)
  const saldoAnticipo   = Math.round((total - anticipoNum) * 100) / 100
  const pagado          = pagos.reduce((a, p) => a + p.monto, 0)
  const saldo           = total - pagado
  const puedeAgregarPago = !esAnulado && saldo > 0.005

  function onDescuentoPctChange(val: string) {
    setDescuentoPct(val)
    setDescuentoMonto((subtotal * Math.max(0, Math.min(100, parseFloat(val) || 0)) / 100).toFixed(2))
  }

  function onDescuentoMontoChange(val: string) {
    setDescuentoMonto(val)
    setDescuentoPct(subtotal > 0 ? ((Math.max(0, parseFloat(val) || 0) / subtotal) * 100).toFixed(2) : '0')
  }

  // ── Tipos de reparación ───────────────────────────────────────────────────────

  function toggleTipo(tipo: TipoServicio) {
    if (tipos.find(t => t.tipo === tipo)) {
      setTipos(prev => prev.filter(t => t.tipo !== tipo))
    } else {
      // Al agregar el primer tipo, heredar el estado manual actual como estado inicial del ítem
      setTipos(prev => [...prev, { key: `new-${Date.now()}`, tipo, detalle: '', precio: '0', estadoItem: estadoManual }])
    }
  }

  function updateTipoField(key: string, field: 'detalle' | 'precio' | 'estadoItem', value: string | null) {
    if (value === null) return
    setTipos(prev => prev.map(t => t.key === key ? { ...t, [field]: value } : t))
  }

  // ── Guardar ───────────────────────────────────────────────────────────────────

  async function handleGuardar() {
    if (!cliente) { toast.error('Debe seleccionar un cliente'); return }
    setSaving(true)

    const payload = {
      fecha,
      fecha_prometida:  fechaPrometida || null,
      cliente_id:       cliente.id,
      detalle:          detalle || null,
      observaciones:    observaciones || null,
      costo_trabajo:    costoTrabajoNum,
      anticipo:         anticipoNum,
      anticipo_metodo:  isNueva && anticipoNum > 0 ? anticipoMetodo : undefined,
      descuento_pct:    parseFloat(descuentoPct) || 0,
      descuento_monto:  descMonto,
      // Si no hay tipos, la API usa este campo como estado manual
      estado: estadoManual,
      tipos: tipos.map(t => ({
        tipo:    t.tipo,
        detalle: t.detalle || null,
        precio:  Math.max(0, parseFloat(t.precio) || 0),
        estado:  t.estadoItem,
      })),
    }

    if (isNueva) {
      const res  = await fetch('/api/dashboard/optica/servicios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error al crear'); setSaving(false); return }
      toast.success(`Servicio ${data.numero} creado`)
      setSaving(false)
      setConfirmImprimirNueva({ id: data.id, numero: data.numero })
    } else {
      const res  = await fetch(`/api/dashboard/optica/servicios/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error al guardar'); setSaving(false); return }
      if (data.nuevo_estado) setEstadoSV(data.nuevo_estado)
      toast.success('Cambios guardados')
      setSaving(false)
    }
  }

  // ── Pagos ─────────────────────────────────────────────────────────────────────

  async function handleSavePago() {
    const monto = parseFloat(pagoForm.monto)
    if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return }
    setSavingPago(true)
    const res  = await fetch(`/api/dashboard/optica/servicios/${id}/pago`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...pagoForm, monto }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error'); setSavingPago(false); return }
    setPagos(prev => [...prev, data])
    setPagoForm({ metodo: 'EFECTIVO', monto: '', concepto: 'SALDO', referencia: '' })
    setShowPagoForm(false)
    setSavingPago(false)
    toast.success('Pago registrado')
  }

  // ── Cambio de estado manual ───────────────────────────────────────────────────

  async function handleCambiarEstado(nuevoEstado: 'entregado' | 'anulado') {
    const res = await fetch(`/api/dashboard/optica/servicios/${id}/cambiar-estado`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevoEstado }),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error'); return }
    setEstadoSV(nuevoEstado)
    if (nuevoEstado === 'anulado') {
      const r = await fetch(`/api/dashboard/optica/servicios/${id}`)
      if (r.ok) { const d = await r.json(); setPagos(d.optica_servicio_pagos ?? []) }
      toast.success('Servicio anulado')
    } else {
      toast.success('Servicio marcado como entregado')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const titulo = isNueva ? 'Nuevo servicio' : (servicio?.numero ?? `SV #${id}`)

  // Progreso de tipos para mostrar en topbar
  const tiposTerminados = tipos.filter(t => t.estadoItem === 'terminado').length

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-6 py-3 bg-white border-b shadow-sm">
        <button onClick={() => router.push('/dashboard/optica/servicios')} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold truncate">{titulo}</h1>
            {sucursalNombre && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200 shrink-0 hidden sm:inline">
                {sucursalNombre}
              </span>
            )}
          </div>
          {!isNueva && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ESTADO_SERVICIO_BADGE[estadoSV]}`}>
                {ESTADO_SERVICIO_LABELS[estadoSV]}
              </span>
              {tipos.length > 0 && (
                <span className="text-xs text-gray-400">{tiposTerminados}/{tipos.length} ítems terminados</span>
              )}
            </div>
          )}
        </div>
        {!isNueva && (
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => window.open(`/dashboard/optica/servicios/${id}/print`, '_blank')}>
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
        )}
        {!esReadonly && (
          <Button onClick={handleGuardar} disabled={saving} size="sm" className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : isNueva ? 'Crear servicio' : 'Guardar'}
          </Button>
        )}
        {!isNueva && estadoSV === 'terminado' && (
          <Button variant="default" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfirmEntregar(true)}>
            <CheckCircle className="w-4 h-4" />
            Marcar entregado
          </Button>
        )}
        {!isNueva && !esEntregado && !esAnulado && (
          <Button variant="outline" size="sm" className="gap-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmAnular(true)}>
            <XCircle className="w-4 h-4" />
            Anular
          </Button>
        )}
      </div>

      {esEntregado && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 text-sm text-blue-800 flex items-center gap-2">
          <span className="font-semibold">Servicio entregado</span>
          <span className="text-blue-700">— Solo lectura.{puedeAgregarPago ? ' Podés registrar el saldo pendiente.' : ''}</span>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-4 space-y-4">

          {/* ── Datos generales ─── */}
          <section className="bg-white rounded-lg border p-4 space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos generales</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div className="flex items-center gap-3">
                <span className={lbl}>Fecha</span>
                <Input type="date" className="h-8 text-sm flex-1" value={fecha} onChange={e => setFecha(e.target.value)} disabled={disabledEdit} />
              </div>
              <div className="flex items-center gap-3">
                <span className={lbl}>Fecha prometida</span>
                <Input type="date" className="h-8 text-sm flex-1" value={fechaPrometida} onChange={e => setFechaPrometida(e.target.value)} disabled={esReadonly} />
              </div>
              <div className="flex items-start gap-3 col-span-2">
                <span className={lbl}>Cliente</span>
                <div className="flex-1 min-w-0">
                  {disabledEdit
                    ? <p className="text-sm text-gray-700 pt-1.5">{cliente?.nombre ?? '—'}</p>
                    : <ClienteSearch value={cliente} onChange={setCliente} />
                  }
                </div>
              </div>
              {cliente?.telefono && (
                <div className="flex items-center gap-3">
                  <span className={lbl}>Teléfono</span>
                  <p className="text-sm text-gray-600">{cliente.telefono}</p>
                </div>
              )}
              <div className="flex items-start gap-3 col-span-2">
                <span className={lbl2 + ' pt-2'}>Detalle</span>
                <textarea
                  className="flex-1 rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  rows={3}
                  placeholder="Descripción general del trabajo a realizar..."
                  value={detalle}
                  onChange={e => setDetalle(e.target.value)}
                  disabled={disabledEdit}
                />
              </div>
            </div>
          </section>

          {/* ── Tipos de reparación (actúan como ítems/tareas) ─── */}
          <section className="bg-white rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Tipos de reparación
                {tipos.length > 0 && (
                  <span className="ml-2 font-normal normal-case text-gray-400">
                    {tiposTerminados}/{tipos.length} terminados
                  </span>
                )}
              </h2>
              {/* Estado manual: visible solo cuando no hay tipos cargados */}
              {tipos.length === 0 && !isNueva && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Estado:</span>
                  <Select
                    value={estadoManual}
                    onValueChange={v => setEstadoManual(v as 'pendiente' | 'en_proceso' | 'terminado')}
                    disabled={disabledEdit}
                  >
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="en_proceso">En proceso</SelectItem>
                      <SelectItem value="terminado">Terminado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {tipos.length === 0 && isNueva && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Estado inicial:</span>
                  <Select
                    value={estadoManual}
                    onValueChange={v => setEstadoManual(v as 'pendiente' | 'en_proceso' | 'terminado')}
                  >
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="en_proceso">En proceso</SelectItem>
                      <SelectItem value="terminado">Terminado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Botones para agregar tipos */}
            {!disabledEdit && (
              <div className="flex flex-wrap gap-2 pb-2 border-b">
                {TIPOS_SERVICIO_LIST.map(tipo => {
                  const selected = tipos.some(t => t.tipo === tipo)
                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => toggleTipo(tipo)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      {selected && <span>✓</span>}
                      {TIPO_SERVICIO_LABELS[tipo]}
                    </button>
                  )
                })}
              </div>
            )}

            {tipos.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">
                {disabledEdit ? 'Sin tipos de reparación' : 'Seleccioná uno o más tipos de reparación'}
              </p>
            ) : (
              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-[160px_1fr_100px_130px_auto] gap-2 text-xs text-gray-400 font-medium px-1">
                  <span>Tipo</span>
                  <span>Detalle</span>
                  <span className="text-right">Precio</span>
                  <span className="text-center">Estado</span>
                  <span />
                </div>
                {tipos.map(t => (
                  <div key={t.key} className={`grid grid-cols-[160px_1fr_100px_130px_auto] gap-2 items-center p-2 rounded-lg border ${
                    t.estadoItem === 'terminado' ? 'bg-green-50 border-green-200' :
                    t.estadoItem === 'en_proceso' ? 'bg-blue-50 border-blue-200' :
                    'bg-gray-50 border-gray-200'
                  }`}>
                    <span className="text-xs font-medium text-gray-700 truncate">
                      {TIPO_SERVICIO_LABELS[t.tipo]}
                    </span>
                    <Input
                      className="h-7 text-xs"
                      placeholder="Descripción..."
                      value={t.detalle}
                      onChange={e => updateTipoField(t.key, 'detalle', e.target.value)}
                      disabled={disabledEdit}
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">$</span>
                      <Input
                        type="number"
                        className="h-7 text-xs text-right"
                        placeholder="0.00"
                        value={t.precio}
                        onChange={e => updateTipoField(t.key, 'precio', e.target.value)}
                        disabled={disabledEdit}
                        min="0" step="0.01"
                      />
                    </div>
                    <Select
                      value={t.estadoItem}
                      onValueChange={v => updateTipoField(t.key, 'estadoItem', v)}
                      disabled={disabledEdit}
                    >
                      <SelectTrigger className={`h-7 text-xs border-0 ${ESTADO_TIPO_SERVICIO_BADGE[t.estadoItem]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="en_proceso">En proceso</SelectItem>
                        <SelectItem value="terminado">Terminado</SelectItem>
                      </SelectContent>
                    </Select>
                    {!disabledEdit && (
                      <button
                        onClick={() => setTipos(prev => prev.filter(x => x.key !== t.key))}
                        className="text-gray-400 hover:text-red-500 p-0.5 text-sm leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Costos ─── */}
          <section className="bg-white rounded-lg border p-4 space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Costos</h2>

            <div className="flex justify-between text-xs text-gray-500">
              <span>Subtotal reparaciones</span>
              <span>{formatARS(subtotalTipos)}</span>
            </div>

            <div className="flex items-center justify-between gap-3 border-t pt-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">Costo de trabajo</span>
              <Input
                type="number" className="h-8 w-28 text-sm text-right"
                value={costoTrabajo}
                onChange={e => setCostoTrabajo(e.target.value)}
                disabled={disabledEdit} min="0" step="0.01" placeholder="0.00"
              />
            </div>

            <div className="flex justify-between font-medium border-t pt-1.5 text-xs">
              <span>Subtotal</span><span>{formatARS(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500 shrink-0">Descuento</span>
              <div className="flex items-center gap-1.5">
                <Input type="number" className="h-7 w-16 text-xs text-right" value={descuentoPct} onChange={e => onDescuentoPctChange(e.target.value)} disabled={disabledEdit} min="0" max="100" step="0.01" />
                <span className="text-gray-400 text-xs shrink-0">%  =</span>
                <Input type="number" className="h-7 w-28 text-xs text-right" value={descuentoMonto} onChange={e => onDescuentoMontoChange(e.target.value)} disabled={disabledEdit} min="0" step="0.01" />
              </div>
            </div>

            <div className="flex justify-between font-semibold text-sm border-t pt-1.5">
              <span>Total</span><span>{formatARS(total)}</span>
            </div>

            {isNueva && (
              <div className="space-y-1.5 border-t pt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Seña / primer pago</p>
                <div className="flex gap-1.5">
                  <Input type="number" className="h-8 flex-1 text-sm text-right" value={anticipo} onChange={e => setAnticipo(e.target.value)} min="0" step="0.01" placeholder="0.00" />
                  <select className="h-8 text-sm border border-input rounded-md px-2 bg-white" value={anticipoMetodo} onChange={e => setAnticipoMetodo(e.target.value as MetodoPagoOptica)}>
                    {METODOS.map(m => <option key={m} value={m}>{METODO_OPTICA_LABELS[m]}</option>)}
                  </select>
                </div>
                {anticipoNum > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Saldo a cobrar</span><span>{formatARS(saldoAnticipo)}</span>
                  </div>
                )}
              </div>
            )}

            {!isNueva && (
              <div className="space-y-1 border-t pt-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Pagado</span><span>{formatARS(pagado)}</span>
                </div>
                <div className="flex justify-between font-semibold text-sm">
                  <span>Saldo pendiente</span>
                  <span className={saldo > 0.005 ? 'text-red-600' : 'text-green-600'}>{formatARS(saldo)}</span>
                </div>
              </div>
            )}
          </section>

          {/* ── Observaciones ─── */}
          <section className="bg-white rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <span className={lbl2 + ' pt-2'}>Observaciones</span>
              <textarea
                className="flex-1 rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                rows={2}
                placeholder="Notas internas..."
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                disabled={disabledEdit}
              />
            </div>
            {!esReadonly && (
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/optica/servicios')}>Cancelar</Button>
                <Button size="sm" onClick={handleGuardar} disabled={saving}>
                  <Save className="w-4 h-4 mr-1.5" />
                  {saving ? 'Guardando...' : isNueva ? 'Crear servicio' : 'Guardar'}
                </Button>
              </div>
            )}
          </section>

          {/* ── Pagos ─── */}
          {!isNueva && (
            <section className="bg-white rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pagos</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Pagado: {formatARS(pagado)} &nbsp;·&nbsp;
                    <span className={saldo > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                      Saldo: {formatARS(saldo)}
                    </span>
                  </p>
                </div>
                {puedeAgregarPago && !showPagoForm && (
                  <Button variant="outline" size="sm" onClick={() => {
                    setPagoForm(f => ({ ...f, concepto: 'PAGO', monto: saldo.toFixed(2) }))
                    setShowPagoForm(true)
                  }} className="h-7 gap-1 text-xs">
                    <Plus className="w-3 h-3" />
                    Registrar pago
                  </Button>
                )}
              </div>

              {showPagoForm && (
                <div className="border rounded-lg p-3 bg-gray-50 space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16 text-right shrink-0">Método</span>
                      <Select value={pagoForm.metodo} onValueChange={v => setPagoForm(f => ({ ...f, metodo: v as MetodoPagoOptica }))}>
                        <SelectTrigger className="h-8 text-sm flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {METODOS.map(m => <SelectItem key={m} value={m}>{METODO_OPTICA_LABELS[m]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16 text-right shrink-0">Monto</span>
                      <Input type="number" placeholder="0.00" className="h-8 text-sm flex-1" value={pagoForm.monto} onChange={e => setPagoForm(f => ({ ...f, monto: e.target.value }))} min="0" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16 text-right shrink-0">Concepto</span>
                      <Input placeholder="SEÑA, SALDO..." className="h-8 text-sm flex-1" value={pagoForm.concepto} onChange={e => setPagoForm(f => ({ ...f, concepto: e.target.value }))} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16 text-right shrink-0">Referencia</span>
                      <Input placeholder="N° transferencia..." className="h-8 text-sm flex-1" value={pagoForm.referencia} onChange={e => setPagoForm(f => ({ ...f, referencia: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowPagoForm(false)}>Cancelar</Button>
                    <Button size="sm" onClick={handleSavePago} disabled={savingPago}>
                      {savingPago ? 'Guardando...' : 'Registrar'}
                    </Button>
                  </div>
                </div>
              )}

              {pagos.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Sin pagos registrados</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b">
                      <th className="text-left pb-1.5 font-medium">Fecha</th>
                      <th className="text-left pb-1.5 font-medium">Método</th>
                      <th className="text-left pb-1.5 font-medium">Concepto</th>
                      <th className="text-right pb-1.5 font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagos.map(p => (
                      <tr key={p.id}>
                        <td className="py-1.5 text-gray-600">{formatFecha(p.fecha_pago)}</td>
                        <td className="py-1.5 text-gray-600">{METODO_OPTICA_LABELS[p.metodo]}</td>
                        <td className="py-1.5 text-gray-600">{p.concepto ?? '—'}</td>
                        <td className="py-1.5 text-right font-medium">{formatARS(p.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}

        </div>
      </div>

      <ConfirmDialog
        open={confirmEntregar}
        onCancel={() => setConfirmEntregar(false)}
        onConfirm={() => { handleCambiarEstado('entregado'); setConfirmEntregar(false) }}
        title="Marcar como entregado"
        description="¿Confirmás que el servicio fue entregado al cliente?"
        confirmLabel="Sí, marcar entregado"
        variant="default"
      />
      <ConfirmDialog
        open={confirmAnular}
        onCancel={() => setConfirmAnular(false)}
        onConfirm={() => { handleCambiarEstado('anulado'); setConfirmAnular(false) }}
        title="Anular servicio"
        description={`Esta acción es irreversible.${saldo > 0.005 ? ` Saldo pendiente: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(saldo)}` : ''} ¿Confirmás?`}
        confirmLabel="Anular"
        variant="destructive"
      />
      <ConfirmDialog
        open={!!confirmImprimirNueva}
        onCancel={() => { router.push(`/dashboard/optica/servicios/${confirmImprimirNueva?.id}`); setConfirmImprimirNueva(null) }}
        onConfirm={() => {
          if (confirmImprimirNueva) {
            window.open(`/dashboard/optica/servicios/${confirmImprimirNueva.id}/print`, '_blank')
            router.push(`/dashboard/optica/servicios/${confirmImprimirNueva.id}`)
          }
          setConfirmImprimirNueva(null)
        }}
        title={`Servicio ${confirmImprimirNueva?.numero ?? ''} creado`}
        description="¿Deseas imprimir o generar el PDF de este servicio?"
        confirmLabel="Sí, imprimir / PDF"
        variant="default"
      />
    </div>
  )
}
