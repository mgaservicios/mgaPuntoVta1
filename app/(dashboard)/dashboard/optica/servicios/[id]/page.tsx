'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Save, CheckCircle, XCircle, Printer, AlertTriangle } from 'lucide-react'
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
  type EstadoServicio, type TipoServicio,
  type EstadoTipoServicio,
} from '@/types/optica'
import type { Cliente } from '@/types/clientes'
import type { NotaCredito } from '@/types/notas-credito'
import type { FormaPago } from '@/types/formas-pago'
import { TIPOS_CON_REFERENCIA } from '@/types/formas-pago'
import ClienteSearch from '@/components/dashboard/ClienteSearch'
import { useSucursalActiva } from '@/hooks/useSucursalActiva'
import { useVendedores } from '@/hooks/useVendedores'

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface TipoForm {
  key: string
  tipo: TipoServicio
  detalle: string
  precio: string
  estadoItem: EstadoTipoServicio
}

interface PagoForm {
  metodo: string
  monto: string
  concepto: string
  referencia: string
  fecha_pago: string
  forma_pago_id: number | null
  cuotas: number | null
  nota_credito_id: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const lbl  = 'w-32 shrink-0 text-right text-xs text-gray-500 leading-none pt-[9px]'
const lbl2 = 'w-32 shrink-0 text-right text-xs text-gray-500 leading-none'

// ── Componente principal ──────────────────────────────────────────────────────

export default function OpticaServicioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params)
  const isNueva = id === 'nueva'
  const router  = useRouter()
  const { nombre: sucursalNombre, isHome } = useSucursalActiva()

  const [servicio, setServicio] = useState<OpticaServicio | null>(null)
  const [loading, setLoading]   = useState(!isNueva)
  const [saving, setSaving]     = useState(false)
  const [estadoSV, setEstadoSV] = useState<EstadoServicio>('pendiente')

  const vendedores = useVendedores()
  const [vendedorId, setVendedorId] = useState<number | null>(null)

  const [fecha, setFecha]                   = useState(new Date().toISOString().slice(0, 10))
  const [fechaPrometida, setFechaPrometida] = useState('')
  const [cliente, setCliente]               = useState<Cliente | null>(null)
  const [clienteError, setClienteError]     = useState(false)
  const [detalle, setDetalle]               = useState('')
  const [observaciones, setObservaciones]   = useState('')

  const [tipos, setTipos]               = useState<TipoForm[]>([])
  const [estadoManual, setEstadoManual] = useState<'pendiente' | 'en_proceso' | 'terminado'>('pendiente')
  const [costoTrabajo, setCostoTrabajo] = useState('0')
  const [descuentoPct, setDescuentoPct]  = useState('0')
  const [descuentoMonto, setDescuentoMonto] = useState('0')
  const [anticipo, setAnticipo]         = useState('0')
  const [anticipoMetodo, setAnticipoMetodo] = useState<string>('EFECTIVO')
  const [anticipoRef, setAnticipoRef]   = useState('')
  const [anticipoFecha, setAnticipoFecha] = useState(new Date().toISOString().slice(0, 10))
  const [anticipoFormaId, setAnticipoFormaId] = useState<number | null>(null)

  const [recargoPct, setRecargoPct]     = useState('0')
  const [recargoMonto, setRecargoMonto] = useState(0)

  const [pagos, setPagos]               = useState<OpticaServicioPago[]>([])
  const [showPagoForm, setShowPagoForm] = useState(false)
  const [pagoForm, setPagoForm]         = useState<PagoForm>({ metodo: '', monto: '', concepto: 'SEÑA', referencia: '', fecha_pago: '', forma_pago_id: null, cuotas: null, nota_credito_id: null })
  const [savingPago, setSavingPago]     = useState(false)
  const [saldoCC, setSaldoCC]           = useState<number | null>(null)
  const [formasPago, setFormasPago]     = useState<FormaPago[]>([])
  const [ncsDisponibles, setNcsDisponibles] = useState<NotaCredito[]>([])

  const [confirmTerminar, setConfirmTerminar] = useState(false)
  const [confirmAnular, setConfirmAnular]     = useState(false)
  const [confirmEntregar, setConfirmEntregar] = useState(false)
  const [confirmImprimirNueva, setConfirmImprimirNueva] = useState<{ id: number; numero: string } | null>(null)

  const esTerminado  = estadoSV === 'terminado'
  const esEntregado  = estadoSV === 'entregado'
  const esAnulado    = estadoSV === 'anulado'
  const esReadonly   = esTerminado || esEntregado || esAnulado
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
      const rm = Number((data as unknown as { recargo_monto?: number }).recargo_monto ?? 0)
      if (rm > 0) {
        setRecargoMonto(rm)
        const baseTotal = Math.round((data.subtotal - (data.descuento_monto ?? 0)) * 100) / 100
        setRecargoPct(baseTotal > 0 ? ((rm / baseTotal) * 100).toFixed(2) : '0')
      }
      setAnticipo(data.anticipo?.toString() ?? '0')
      setPagos(data.optica_servicio_pagos ?? [])
      setLoading(false)
    }
    load()
  }, [id, isNueva, router])

  // ── Formas de pago ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/dashboard/formas-pago').then(r => r.json()).then(data => {
      const fps: FormaPago[] = Array.isArray(data) ? data : []
      setFormasPago(fps)
      const primero = fps[0]
      if (primero) {
        setAnticipoMetodo(primero.nombre)
        setAnticipoFormaId(primero.id)
        setPagoForm(f => ({ ...f, metodo: primero.nombre, forma_pago_id: primero.id }))
      }
    }).catch(() => {})
  }, [])

  // ── Saldo CC del cliente ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!cliente) { setSaldoCC(null); setNcsDisponibles([]); return }
    fetch(`/api/dashboard/listados/cobranzas?cliente_id=${cliente.id}`)
      .then(r => r.json())
      .then((data: { saldo_actual: number }[]) => setSaldoCC(data[0]?.saldo_actual ?? 0))
      .catch(() => setSaldoCC(null))
    fetch(`/api/dashboard/notas-credito?cliente_id=${cliente.id}&estado=pendiente`)
      .then(r => r.json())
      .then(data => setNcsDisponibles(Array.isArray(data) ? data : []))
      .catch(() => setNcsDisponibles([]))
  }, [cliente])

  // ── Cálculos ──────────────────────────────────────────────────────────────────

  const subtotalTipos   = tipos.reduce((acc, t) => acc + Math.max(0, parseFloat(t.precio) || 0), 0)
  const costoTrabajoNum = Math.max(0, parseFloat(costoTrabajo) || 0)
  const subtotal        = Math.round((subtotalTipos + costoTrabajoNum) * 100) / 100
  const descMonto       = Math.min(Math.max(0, parseFloat(descuentoMonto) || 0), subtotal)
  const total           = Math.round((subtotal - descMonto) * 100) / 100
  const totalFinal      = Math.round((total + recargoMonto) * 100) / 100
  const anticipoNum     = Math.max(0, parseFloat(anticipo) || 0)
  const saldoAnticipo   = Math.round((totalFinal - anticipoNum) * 100) / 100
  const pagado          = pagos.reduce((a, p) => a + p.monto, 0)
  const saldo           = (isNueva ? totalFinal : (servicio?.total ?? totalFinal)) - pagado
  const puedeAgregarPago = !esAnulado && saldo > 0.005

  function onDescuentoPctChange(val: string) {
    setDescuentoPct(val)
    setDescuentoMonto((subtotal * Math.max(0, Math.min(100, parseFloat(val) || 0)) / 100).toFixed(2))
  }

  function onDescuentoMontoChange(val: string) {
    setDescuentoMonto(val)
    setDescuentoPct(subtotal > 0 ? ((Math.max(0, parseFloat(val) || 0) / subtotal) * 100).toFixed(2) : '0')
  }

  function onRecargoPctChangeSV(val: string) {
    setRecargoPct(val)
    const pct = Math.max(0, parseFloat(val) || 0)
    setRecargoMonto(Math.round(total * pct / 100 * 100) / 100)
  }

  function onRecargoMontoChangeSV(val: string) {
    const rm = Math.max(0, parseFloat(val) || 0)
    setRecargoMonto(rm)
    setRecargoPct(total > 0 ? ((rm / total) * 100).toFixed(2) : '0')
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
    if (!cliente) { toast.error('Debe seleccionar un cliente'); setClienteError(true); return }
    setSaving(true)

    const payload = {
      fecha,
      fecha_prometida:  fechaPrometida || null,
      cliente_id:       cliente.id,
      vendedor_id:      vendedorId,
      detalle:          detalle || null,
      observaciones:    observaciones || null,
      costo_trabajo:    costoTrabajoNum,
      anticipo:              anticipoNum,
      anticipo_metodo:       isNueva && anticipoNum > 0 ? anticipoMetodo           : undefined,
      anticipo_referencia:   isNueva && anticipoNum > 0 ? (anticipoRef || null)    : undefined,
      anticipo_fecha:        isNueva && anticipoNum > 0 ? (anticipoFecha || null)  : undefined,
      anticipo_forma_id:     isNueva && anticipoNum > 0 ? (anticipoFormaId ?? null): undefined,
      descuento_pct:    parseFloat(descuentoPct) || 0,
      descuento_monto:  descMonto,
      recargo_monto:    recargoMonto,
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
    if (!pagoForm.metodo) { toast.error('Seleccioná un método de pago'); return }
    if (pagoForm.metodo === 'NOTA_CREDITO' && !pagoForm.nota_credito_id) { toast.error('Seleccioná una nota de crédito'); return }
    setSavingPago(true)
    const res  = await fetch(`/api/dashboard/optica/servicios/${id}/pago`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metodo:          pagoForm.metodo,
        monto,
        concepto:        pagoForm.concepto,
        referencia:      pagoForm.referencia || null,
        fecha_pago:      pagoForm.fecha_pago || new Date().toISOString().slice(0, 10),
        forma_pago_id:   pagoForm.forma_pago_id,
        cuotas:          pagoForm.cuotas,
        nota_credito_id: pagoForm.nota_credito_id,
        recargo_monto:   recargoMonto,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error'); setSavingPago(false); return }
    if (recargoMonto > 0 && servicio) {
      setServicio(prev => prev ? { ...prev, total: Math.round((prev.total - (prev as unknown as {recargo_monto?:number}).recargo_monto! + recargoMonto) * 100) / 100 } : prev)
    }
    setRecargoMonto(0)
    setRecargoPct('0')
    setPagos(prev => [...prev, data])
    const primero = formasPago[0]
    setPagoForm({ metodo: primero?.nombre ?? '', monto: '', concepto: 'SALDO', referencia: '', fecha_pago: '', forma_pago_id: primero?.id ?? null, cuotas: null, nota_credito_id: null })
    setShowPagoForm(false)
    setSavingPago(false)
    toast.success('Pago registrado')
  }

  // ── Cambio de estado manual ───────────────────────────────────────────────────

  async function handleCambiarEstado(nuevoEstado: 'terminado' | 'entregado' | 'anulado') {
    const res = await fetch(`/api/dashboard/optica/servicios/${id}/cambiar-estado`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevoEstado }),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error'); return }
    setEstadoSV(nuevoEstado)
    if (nuevoEstado === 'anulado') {
      const r = await fetch(`/api/dashboard/optica/servicios/${id}`)
      if (r.ok) { const d = await r.json(); setPagos(d.optica_servicio_pagos ?? []) }
      toast.success('Servicio anulado')
    } else if (nuevoEstado === 'terminado') {
      toast.success('Servicio marcado como terminado')
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

  if (isNueva && !isHome) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <p className="font-semibold text-gray-800">No puede crear un servicio desde esta sucursal</p>
          <p className="text-sm text-gray-500 mt-1">
            Está visualizando otra sucursal. Seleccione su sucursal en el selector para continuar.
          </p>
        </div>
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
        {!isNueva && ['pendiente', 'en_proceso'].includes(estadoSV) && (
          <Button variant="default" size="sm" className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => setConfirmTerminar(true)}>
            <CheckCircle className="w-4 h-4" />
            Terminar
          </Button>
        )}
        {!isNueva && esTerminado && (
          <Button variant="default" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfirmEntregar(true)}>
            <CheckCircle className="w-4 h-4" />
            Marcar entregado
          </Button>
        )}
        {!isNueva && !esReadonly && (
          <Button variant="outline" size="sm" className="gap-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmAnular(true)}>
            <XCircle className="w-4 h-4" />
            Anular
          </Button>
        )}
      </div>

      {esReadonly && !esAnulado && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 text-sm text-blue-800 flex items-center gap-2">
          <span className="font-semibold">{esTerminado ? 'Servicio terminado' : 'Servicio entregado'}</span>
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
                    : <ClienteSearch
                        value={cliente}
                        onChange={(c) => { setCliente(c); if (c) setClienteError(false) }}
                        error={clienteError}
                        required
                      />
                  }
                </div>
              </div>
              {cliente?.telefono && (
                <div className="flex items-center gap-3">
                  <span className={lbl}>Teléfono</span>
                  <p className="text-sm text-gray-600">{cliente.telefono}</p>
                </div>
              )}
              {isNueva && (
                <div className="flex items-start gap-3">
                  <span className={lbl}>Vendedor</span>
                  <div className="flex-1 min-w-0">
                    <Select
                      value={vendedorId?.toString() ?? ''}
                      onValueChange={v => setVendedorId(Number(v))}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Seleccionar vendedor…" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendedores.map(v => (
                          <SelectItem key={v.id} value={v.id.toString()}>{v.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-amber-600 shrink-0">Recargo</span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number" className="h-7 w-16 text-xs text-right"
                  value={recargoPct}
                  onChange={e => onRecargoPctChangeSV(e.target.value)}
                  disabled={disabledEdit} min="0" max="100" step="0.01" placeholder="0"
                />
                <span className="text-gray-400 text-xs shrink-0">%  =</span>
                <Input
                  type="number" className="h-7 w-28 text-xs text-right text-amber-600"
                  value={recargoMonto > 0 ? recargoMonto : ''}
                  onChange={e => onRecargoMontoChangeSV(e.target.value)}
                  disabled={disabledEdit} min="0" step="0.01" placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex justify-between font-semibold text-sm border-t pt-1.5">
              <span>Total</span><span>{formatARS(totalFinal)}</span>
            </div>

            {isNueva && (
              <div className="space-y-1.5 border-t pt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Seña / primer pago</p>
                {saldoCC !== null && saldoCC < -0.001 && (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                    <p className="text-xs text-green-800">
                      <span className="font-semibold">Saldo a favor en CC:</span> {formatARS(Math.abs(saldoCC))}
                    </p>
                    <button
                      type="button"
                      className="text-xs text-green-700 font-medium underline hover:no-underline ml-2"
                      onClick={() => {
                        const aplicar = Math.min(Math.abs(saldoCC), total)
                        setAnticipo(aplicar.toFixed(2))
                        setAnticipoMetodo('CUENTA_CORRIENTE')
                      }}
                    >
                      Aplicar
                    </button>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <Input type="number" className="h-8 flex-1 text-sm text-right" value={anticipo} onChange={e => setAnticipo(e.target.value)} min="0" step="0.01" placeholder="0.00" />
                  <select
                    className="h-8 text-sm border border-input rounded-md px-2 bg-white"
                    value={anticipoMetodo}
                    onChange={e => {
                      const fp = formasPago.find(f => f.nombre === e.target.value)
                      setAnticipoMetodo(e.target.value)
                      setAnticipoFormaId(fp?.id ?? null)
                      if (!fp || !TIPOS_CON_REFERENCIA.includes(fp.tipo)) { setAnticipoRef(''); setAnticipoFecha('') }
                    }}
                  >
                    {formasPago.map(fp => <option key={fp.id} value={fp.nombre}>{fp.nombre}</option>)}
                    <option value="CUENTA_CORRIENTE">Cuenta corriente</option>
                  </select>
                </div>
                {(() => {
                  const fp = formasPago.find(f => f.nombre === anticipoMetodo)
                  if (!fp || !TIPOS_CON_REFERENCIA.includes(fp.tipo)) return null
                  return (
                    <div className="flex gap-1.5 mt-1.5">
                      <Input placeholder="Referencia (opcional)" className="h-7 flex-1 text-xs" value={anticipoRef} onChange={e => setAnticipoRef(e.target.value)} />
                      <Input type="date" className="h-7 w-36 text-xs" value={anticipoFecha} onChange={e => setAnticipoFecha(e.target.value)} />
                    </div>
                  )
                })()}
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
                  {saldoCC !== null && saldoCC < -0.001 && (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                      <p className="text-xs text-green-800">
                        <span className="font-semibold">Saldo a favor en CC:</span> {formatARS(Math.abs(saldoCC))}
                      </p>
                      <button
                        type="button"
                        className="text-xs text-green-700 font-medium underline hover:no-underline ml-2"
                        onClick={() => {
                          const aplicar = Math.min(Math.abs(saldoCC), saldo)
                          setPagoForm(f => ({ ...f, metodo: 'CUENTA_CORRIENTE', monto: aplicar.toFixed(2), concepto: 'Saldo CC' }))
                        }}
                      >
                        Aplicar
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16 text-right shrink-0">Método</span>
                      <select
                        className="h-8 text-sm border border-input rounded-md px-2 bg-white flex-1"
                        value={pagoForm.metodo}
                        onChange={e => {
                          const fp = formasPago.find(f => f.nombre === e.target.value)
                          setPagoForm(f => ({ ...f, metodo: e.target.value, forma_pago_id: fp?.id ?? null, cuotas: null, nota_credito_id: null, referencia: '' }))
                        }}
                      >
                        {formasPago.map(fp => <option key={fp.id} value={fp.nombre}>{fp.nombre}</option>)}
                        <option value="CUENTA_CORRIENTE">Cuenta corriente</option>
                        <option value="NOTA_CREDITO">Nota de crédito</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16 text-right shrink-0">Monto</span>
                      <Input type="number" placeholder="0.00" className="h-8 text-sm flex-1" value={pagoForm.monto} onChange={e => setPagoForm(f => ({ ...f, monto: e.target.value }))} min="0" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16 text-right shrink-0">Concepto</span>
                      <Input placeholder="SEÑA, SALDO..." className="h-8 text-sm flex-1" value={pagoForm.concepto} onChange={e => setPagoForm(f => ({ ...f, concepto: e.target.value }))} />
                    </div>
                    {(() => {
                      const fp = formasPago.find(f => f.nombre === pagoForm.metodo)
                      if (!fp || !TIPOS_CON_REFERENCIA.includes(fp.tipo)) return null
                      return (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-16 text-right shrink-0">Referencia</span>
                            <Input placeholder="N° transf..." className="h-8 text-sm flex-1" value={pagoForm.referencia} onChange={e => setPagoForm(f => ({ ...f, referencia: e.target.value }))} />
                          </div>
                          <div className="flex items-center gap-2 col-span-2">
                            <span className="text-xs text-gray-500 w-16 text-right shrink-0">Fecha</span>
                            <Input type="date" className="h-8 text-sm w-36" value={pagoForm.fecha_pago || new Date().toISOString().slice(0, 10)} onChange={e => setPagoForm(f => ({ ...f, fecha_pago: e.target.value }))} />
                          </div>
                        </>
                      )
                    })()}
                    {(() => {
                      const fp = formasPago.find(f => f.nombre === pagoForm.metodo)
                      if (fp?.tipo !== 'TARJETA_CREDITO' || !fp.formas_pago_cuotas?.length) return null
                      return (
                        <div className="flex items-center gap-2 col-span-2">
                          <span className="text-xs text-gray-500 w-16 text-right shrink-0">Cuotas</span>
                          <select
                            className="h-8 text-sm border border-input rounded-md px-2 bg-white"
                            value={pagoForm.cuotas ?? ''}
                            onChange={e => {
                              const cuotaNum = e.target.value ? parseInt(e.target.value) : null
                              setPagoForm(f => ({ ...f, cuotas: cuotaNum }))
                              if (cuotaNum) {
                                const cuota = fp.formas_pago_cuotas?.find(c => c.cantidad_cuotas === cuotaNum)
                                if (cuota) {
                                  const pct = cuota.recargo_pct
                                  const base = isNueva ? total : (servicio?.total ?? total)
                                  setRecargoPct(pct.toString())
                                  setRecargoMonto(Math.round(base * pct / 100 * 100) / 100)
                                }
                              }
                            }}
                          >
                            <option value="">Sin cuotas</option>
                            {fp.formas_pago_cuotas.sort((a, b) => a.cantidad_cuotas - b.cantidad_cuotas).map(c => (
                              <option key={c.id} value={c.cantidad_cuotas}>
                                {c.cantidad_cuotas}x {c.recargo_pct > 0 ? `(+${c.recargo_pct}% rec.)` : 'sin recargo'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })()}
                    {pagoForm.metodo === 'NOTA_CREDITO' && (
                      <div className="col-span-2">
                        {!cliente ? (
                          <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">Seleccioná un cliente para ver sus NCs</p>
                        ) : ncsDisponibles.length === 0 ? (
                          <p className="text-xs text-gray-400 bg-gray-50 rounded px-2 py-1">Sin notas de crédito disponibles</p>
                        ) : (
                          <select
                            className="w-full h-8 text-sm border border-input rounded-md px-2 bg-white"
                            value={pagoForm.nota_credito_id ?? ''}
                            onChange={e => {
                              const nc = ncsDisponibles.find(n => String(n.id) === e.target.value)
                              if (!nc) { setPagoForm(f => ({ ...f, nota_credito_id: null, monto: '' })); return }
                              const m = Math.min(nc.monto_disponible, saldo)
                              setPagoForm(f => ({ ...f, nota_credito_id: nc.id, monto: m.toFixed(2) }))
                            }}
                          >
                            <option value="">Seleccioná una NC…</option>
                            {ncsDisponibles.map(nc => (
                              <option key={nc.id} value={nc.id}>
                                {nc.numero} — {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(nc.monto_disponible)} disp.
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
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
                        <td className="py-1.5 text-gray-600">{METODO_OPTICA_LABELS[p.metodo as keyof typeof METODO_OPTICA_LABELS] ?? p.metodo}</td>
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
        open={confirmTerminar}
        onCancel={() => setConfirmTerminar(false)}
        onConfirm={() => { handleCambiarEstado('terminado'); setConfirmTerminar(false) }}
        title="Marcar como terminado"
        description="Se marcarán todos los tipos de reparación como terminados. ¿Confirmás?"
        confirmLabel="Sí, terminar"
        variant="default"
      />
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
