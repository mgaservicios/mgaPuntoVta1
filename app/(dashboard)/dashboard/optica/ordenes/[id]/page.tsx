'use client'

import { useEffect, useState, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Trash2, X, Save, CheckCircle, XCircle,
  Upload, FileText, Pencil, Printer, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import {
  ESTADO_OPTICA_LABELS, METODO_OPTICA_LABELS, USO_ITEM_LABELS,
  type OpticaOrden, type OpticaOrdenTarea, type OpticaOrdenPago,
  type EstadoOpticaOrden, type TipoOpticaItem, type UsoItem,
  type EstadoTarea,
} from '@/types/optica'
import type { Cliente } from '@/types/clientes'
import type { OpticaMedico } from '@/types/optica'
import type { NotaCredito } from '@/types/notas-credito'
import type { FormaPago } from '@/types/formas-pago'
import { TIPOS_CON_REFERENCIA } from '@/types/formas-pago'
import ClienteSearch from '@/components/dashboard/ClienteSearch'
import UsoToggle from '../../_components/UsoToggle'
import ArmazonSearch from '../../_components/ArmazonSearch'
import MedicoSearch from '../../_components/MedicoSearch'
import ItemRow, { type FormItem } from '../../_components/ItemRow'
import { useSucursalActiva } from '@/hooks/useSucursalActiva'
import { useVendedores } from '@/hooks/useVendedores'

// ── Tipos locales ──────────────────────────────────────────────────────────────

interface TareaForm {
  titulo: string
  descripcion: string
  estado: EstadoTarea
  laboratorio_nombre: string
  laboratorio_tipo: 'propio' | 'externo' | ''
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const ESTADO_BADGE: Record<EstadoOpticaOrden, string> = {
  pendiente: 'bg-slate-100 text-slate-700 border-slate-200',
  en_proceso: 'bg-blue-100 text-blue-700 border-blue-200',
  en_laboratorio: 'bg-orange-100 text-orange-700 border-orange-200',
  terminado: 'bg-green-100 text-green-700 border-green-200',
  entregado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  anulado: 'bg-red-100 text-red-700 border-red-200',
}

const TAREA_BADGE: Record<EstadoTarea, string> = {
  en_proceso: 'bg-blue-100 text-blue-700',
  en_laboratorio: 'bg-orange-100 text-orange-700',
  terminada: 'bg-green-100 text-green-700',
}

// Clases para el patrón label-al-costado (igual que artículos)
const lbl = 'w-32 shrink-0 text-right text-xs text-gray-500 leading-none pt-[9px]'
const lbl2 = 'w-32 shrink-0 text-right text-xs text-gray-500 leading-none'

// ── Componente principal ────────────────────────────────────────────────────────

export default function OpticaOrdenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNueva = id === 'nueva'
  const router = useRouter()
  const { nombre: sucursalNombre, isHome } = useSucursalActiva()

  const [orden, setOrden] = useState<OpticaOrden | null>(null)
  const [loading, setLoading] = useState(!isNueva)
  const [saving, setSaving] = useState(false)
  const [estadoOT, setEstadoOT] = useState<EstadoOpticaOrden>('pendiente')

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [fechaPrometida, setFechaPrometida] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [clienteError, setClienteError] = useState(false)
  const [medico, setMedico] = useState<OpticaMedico | null>(null)
  const [medicoNombre, setMedicoNombre] = useState('')
  const [recetaUrl, setRecetaUrl] = useState('')
  const [uploadingReceta, setUploadingReceta] = useState(false)

  const [grad, setGrad] = useState({
    lejos_od_esfera: '', lejos_od_cilindro: '', lejos_od_eje: '',
    lejos_oi_esfera: '', lejos_oi_cilindro: '', lejos_oi_eje: '',
    cerca_od_esfera: '', cerca_od_cilindro: '', cerca_od_eje: '',
    cerca_oi_esfera: '', cerca_oi_cilindro: '', cerca_oi_eje: '',
    adicion: '', dp: '',
  })

  const vendedores = useVendedores()
  const [vendedorId, setVendedorId] = useState<number | null>(null)

  const [listas, setListas] = useState<{ id: number; nombre: string }[]>([])
  const [listaId, setListaId] = useState<number | null>(null)

  const [items, setItems] = useState<FormItem[]>([])
  const [costoTrabajo, setCostoTrabajo] = useState('0')
  const [descuentoPct, setDescuentoPct] = useState('0')
  const [descuentoMonto, setDescuentoMonto] = useState('0')
  const [anticipo, setAnticipo] = useState('0')
  const [anticipoMetodo, setAnticipoMetodo] = useState<string>('EFECTIVO')
  const [anticipoRef, setAnticipoRef] = useState('')
  const [anticipoFecha, setAnticipoFecha] = useState(new Date().toISOString().slice(0, 10))
  const [anticipoFormaId, setAnticipoFormaId] = useState<number | null>(null)

  const [observaciones, setObservaciones] = useState('')

  const [tareas, setTareas] = useState<OpticaOrdenTarea[]>([])
  const [showTareaForm, setShowTareaForm] = useState(false)
  const [tareaForm, setTareaForm] = useState<TareaForm>({
    titulo: '', descripcion: '', estado: 'en_proceso', laboratorio_nombre: '', laboratorio_tipo: '',
  })
  const [editingTareaId, setEditingTareaId] = useState<number | null>(null)
  const [savingTarea, setSavingTarea] = useState(false)

  const [pagos, setPagos] = useState<OpticaOrdenPago[]>([])
  const [showPagoForm, setShowPagoForm] = useState(false)
  const [pagoForm, setPagoForm] = useState<PagoForm>({ metodo: '', monto: '', concepto: 'SEÑA', referencia: '', fecha_pago: '', forma_pago_id: null, cuotas: null, nota_credito_id: null })
  const [savingPago, setSavingPago] = useState(false)
  const [saldoCC, setSaldoCC] = useState<number | null>(null)
  const [formasPago, setFormasPago] = useState<FormaPago[]>([])
  const [ncsDisponibles, setNcsDisponibles] = useState<NotaCredito[]>([])
  const [recargoPct, setRecargoPct] = useState('0')
  const [recargoMonto, setRecargoMonto] = useState(0)

  const [confirmTerminar, setConfirmTerminar] = useState(false)
  const [confirmAnular, setConfirmAnular] = useState(false)
  const [confirmEntregar, setConfirmEntregar] = useState(false)
  const [confirmImprimirNueva, setConfirmImprimirNueva] = useState<{ id: number; numero: string } | null>(null)

  const tieneTareas = tareas.length > 0
  const tienePagos  = pagos.length > 0
  const esFinalizado = ['terminado', 'entregado'].includes(estadoOT)
  const esAnulado    = estadoOT === 'anulado'
  const esReadonly   = esFinalizado || esAnulado
  const esSoloFechaPrometida = !isNueva && !esReadonly && tieneTareas

  // ── Cargar orden ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isNueva) return
    const load = async () => {
      const res = await fetch(`/api/dashboard/optica/ordenes/${id}`)
      if (!res.ok) { toast.error('No se pudo cargar la orden'); router.push('/dashboard/optica/ordenes'); return }
      const data: OpticaOrden = await res.json()
      setOrden(data)
      setEstadoOT(data.estado)
      setFecha(data.fecha)
      setFechaPrometida(data.fecha_prometida ?? '')
      if (data.clientes) setCliente({ id: data.cliente_id!, nombre: data.clientes.nombre, telefono: data.clientes.telefono ?? null } as Cliente)
      if (data.optica_medicos) setMedico({ id: data.medico_id!, nombre: data.optica_medicos.nombre, matricula: data.optica_medicos.matricula, telefono: null, activo: true, created_at: '' })
      setMedicoNombre(data.medico_nombre ?? '')
      setRecetaUrl(data.receta_url ?? '')
      setGrad({
        lejos_od_esfera: data.lejos_od_esfera?.toString() ?? '',
        lejos_od_cilindro: data.lejos_od_cilindro?.toString() ?? '',
        lejos_od_eje: data.lejos_od_eje?.toString() ?? '',
        lejos_oi_esfera: data.lejos_oi_esfera?.toString() ?? '',
        lejos_oi_cilindro: data.lejos_oi_cilindro?.toString() ?? '',
        lejos_oi_eje: data.lejos_oi_eje?.toString() ?? '',
        cerca_od_esfera: data.cerca_od_esfera?.toString() ?? '',
        cerca_od_cilindro: data.cerca_od_cilindro?.toString() ?? '',
        cerca_od_eje: data.cerca_od_eje?.toString() ?? '',
        cerca_oi_esfera: data.cerca_oi_esfera?.toString() ?? '',
        cerca_oi_cilindro: data.cerca_oi_cilindro?.toString() ?? '',
        cerca_oi_eje: data.cerca_oi_eje?.toString() ?? '',
        adicion: data.adicion?.toString() ?? '',
        dp: data.dp?.toString() ?? '',
      })
      setItems((data.optica_orden_items ?? []).map(i => ({
        key: String(i.id),
        tipo: i.tipo,
        uso: i.uso,
        nombre: i.nombre,
        armazon_propio: i.armazon_propio,
        articulo_id: i.articulo_id,
        variante_id: i.variante_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        descuento_pct: i.descuento_pct,
        notas: i.notas ?? '',
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
      setObservaciones(data.observaciones ?? '')
      setTareas(data.optica_orden_tareas ?? [])
      setPagos(data.optica_orden_pagos ?? [])
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

  // ── Saldo CC del cliente ───────────────────────────────────────────────────────

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

  // ── Cargar listas de precio ───────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/dashboard/listas-precio')
      .then(r => r.json())
      .then(data => {
        const venta = (Array.isArray(data) ? data : []).filter((l: { categoria: string; activo: boolean }) => l.categoria === 'venta' && l.activo)
        setListas(venta)
        const def = venta.find((l: { nombre: string }) => /p[uú]blic/i.test(l.nombre)) ?? venta[0]
        if (def) setListaId(def.id)
      })
      .catch(() => {/* sin listas disponibles */})
  }, [])

  // ── Cálculos ──────────────────────────────────────────────────────────────────

  const subtotalItems = items.reduce((acc, i) => {
    if (i.tipo === 'armazon' && i.armazon_propio) return acc
    return acc + Math.round(i.cantidad * i.precio_unitario * (1 - i.descuento_pct / 100) * 100) / 100
  }, 0)
  const costoTrabajoNum = Math.max(0, parseFloat(costoTrabajo) || 0)
  const subtotal        = Math.round((subtotalItems + costoTrabajoNum) * 100) / 100
  const descMonto       = Math.min(Math.max(0, parseFloat(descuentoMonto) || 0), subtotal)
  const total           = Math.round((subtotal - descMonto) * 100) / 100
  const totalFinal      = Math.round((total + recargoMonto) * 100) / 100
  const anticipoNum     = Math.max(0, parseFloat(anticipo) || 0)
  const saldoAnticipo   = Math.round((totalFinal - anticipoNum) * 100) / 100
  const pagado          = pagos.reduce((a, p) => a + p.monto, 0)
  const saldo           = (isNueva ? totalFinal : (orden?.total ?? totalFinal)) - pagado
  const puedeAgregarPago = !esAnulado && saldo > 0.005

  function onRecargoPctChangeOT(val: string) {
    setRecargoPct(val)
    const pct = Math.max(0, parseFloat(val) || 0)
    setRecargoMonto(Math.round(total * pct / 100 * 100) / 100)
  }

  function onRecargoMontoChangeOT(val: string) {
    const rm = Math.max(0, parseFloat(val) || 0)
    setRecargoMonto(rm)
    setRecargoPct(total > 0 ? ((rm / total) * 100).toFixed(2) : '0')
  }
  const disabledEdit = esReadonly || esSoloFechaPrometida

  function onDescuentoPctChange(val: string) {
    setDescuentoPct(val)
    const pct = Math.max(0, Math.min(100, parseFloat(val) || 0))
    setDescuentoMonto((subtotal * pct / 100).toFixed(2))
  }

  function onDescuentoMontoChange(val: string) {
    setDescuentoMonto(val)
    const monto = Math.max(0, parseFloat(val) || 0)
    setDescuentoPct(subtotal > 0 ? ((monto / subtotal) * 100).toFixed(2) : '0')
  }

  // ── Graduación ────────────────────────────────────────────────────────────────

  function toNum(v: string) {
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }

  function gradPayload() {
    return {
      lejos_od_esfera: toNum(grad.lejos_od_esfera), lejos_od_cilindro: toNum(grad.lejos_od_cilindro), lejos_od_eje: grad.lejos_od_eje ? parseInt(grad.lejos_od_eje) : null,
      lejos_oi_esfera: toNum(grad.lejos_oi_esfera), lejos_oi_cilindro: toNum(grad.lejos_oi_cilindro), lejos_oi_eje: grad.lejos_oi_eje ? parseInt(grad.lejos_oi_eje) : null,
      cerca_od_esfera: toNum(grad.cerca_od_esfera), cerca_od_cilindro: toNum(grad.cerca_od_cilindro), cerca_od_eje: grad.cerca_od_eje ? parseInt(grad.cerca_od_eje) : null,
      cerca_oi_esfera: toNum(grad.cerca_oi_esfera), cerca_oi_cilindro: toNum(grad.cerca_oi_cilindro), cerca_oi_eje: grad.cerca_oi_eje ? parseInt(grad.cerca_oi_eje) : null,
      adicion: toNum(grad.adicion), dp: toNum(grad.dp),
    }
  }

  // ── Items ─────────────────────────────────────────────────────────────────────

  function addItem(tipo: TipoOpticaItem) {
    setItems(prev => [...prev, {
      key: `new-${Date.now()}`,
      tipo,
      uso: (tipo === 'armazon' || tipo === 'cristal') ? 'lejos' : null,
      nombre: '',
      armazon_propio: false,
      articulo_id: null,
      variante_id: null,
      cantidad: 1,
      precio_unitario: 0,
      descuento_pct: 0,
      notas: '',
    }])
  }

  function updateItem<K extends keyof FormItem>(key: string, field: K, value: FormItem[K]) {
    setItems(prev => prev.map(i => {
      if (i.key !== key) return i
      const updated = { ...i, [field]: value }
      if (field === 'armazon_propio' && value === true) {
        return { ...updated, precio_unitario: 0, descuento_pct: 0, articulo_id: null, variante_id: null }
      }
      return updated
    }))
  }

  // ── Guardar ───────────────────────────────────────────────────────────────────

  async function handleGuardar() {
    setSaving(true)

    if (esSoloFechaPrometida) {
      const res = await fetch(`/api/dashboard/optica/ordenes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha_prometida: fechaPrometida || null }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error al guardar'); setSaving(false); return }
      toast.success('Fecha prometida actualizada')
      setSaving(false)
      return
    }

    if (!cliente) {
      toast.error('Debe seleccionar un cliente')
      setClienteError(true)
      setSaving(false)
      return
    }


    const payload = {
      fecha,
      fecha_prometida: fechaPrometida || null,
      cliente_id: cliente?.id ?? null,
      vendedor_id: vendedorId,
      medico_id: medico?.id ?? null,
      medico_nombre: medicoNombre || null,
      receta_url: recetaUrl || null,
      ...gradPayload(),
      observaciones: observaciones || null,
      costo_trabajo: costoTrabajoNum,
      anticipo: anticipoNum,
      anticipo_metodo:    isNueva && anticipoNum > 0 ? anticipoMetodo    : undefined,
      anticipo_referencia: isNueva && anticipoNum > 0 ? (anticipoRef || null) : undefined,
      anticipo_fecha:     isNueva && anticipoNum > 0 ? (anticipoFecha || null) : undefined,
      anticipo_forma_id:  isNueva && anticipoNum > 0 ? (anticipoFormaId ?? null) : undefined,
      descuento_pct: parseFloat(descuentoPct) || 0,
      descuento_monto: descMonto,
      recargo_monto: recargoMonto,
      items: items.map(i => ({
        tipo: i.tipo,
        uso: i.uso,
        nombre: i.nombre,
        armazon_propio: i.armazon_propio,
        articulo_id: i.articulo_id,
        variante_id: i.variante_id,
        cantidad: i.cantidad,
        precio_unitario: i.tipo === 'armazon' && i.armazon_propio ? 0 : i.precio_unitario,
        descuento_pct: i.tipo === 'armazon' && i.armazon_propio ? 0 : i.descuento_pct,
        notas: i.notas || null,
      })),
    }

    if (isNueva) {
      const res = await fetch('/api/dashboard/optica/ordenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error al crear'); setSaving(false); return }
      toast.success(`Orden ${data.numero} creada`)
      setSaving(false)
      setConfirmImprimirNueva({ id: data.id, numero: data.numero })
      return
    } else {
      const res = await fetch(`/api/dashboard/optica/ordenes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error al guardar'); setSaving(false); return }
      toast.success('Cambios guardados')
      setSaving(false)
    }
  }

  // ── Upload receta ─────────────────────────────────────────────────────────────

  async function handleUploadReceta(file: File) {
    setUploadingReceta(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/dashboard/optica/ordenes/upload-receta', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error al subir'); setUploadingReceta(false); return }
    setRecetaUrl(data.url)
    setUploadingReceta(false)
    toast.success('Receta cargada')
  }

  // ── Tareas ────────────────────────────────────────────────────────────────────

  function resetTareaForm() {
    setTareaForm({ titulo: '', descripcion: '', estado: 'en_proceso', laboratorio_nombre: '', laboratorio_tipo: '' })
    setEditingTareaId(null)
    setShowTareaForm(false)
  }

  async function handleSaveTarea() {
    if (!tareaForm.titulo.trim()) { toast.error('El título es obligatorio'); return }
    setSavingTarea(true)
    const payload = {
      titulo: tareaForm.titulo, descripcion: tareaForm.descripcion || null,
      estado: tareaForm.estado,
      laboratorio_nombre: tareaForm.laboratorio_nombre || null,
      laboratorio_tipo: tareaForm.laboratorio_tipo || null,
    }
    if (editingTareaId) {
      const res = await fetch(`/api/dashboard/optica/ordenes/${id}/tareas/${editingTareaId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error'); setSavingTarea(false); return }
      setTareas(prev => prev.map(t => t.id === editingTareaId ? data.tarea : t))
      if (data.nuevo_estado_ot) setEstadoOT(data.nuevo_estado_ot)
      if (data.nuevo_estado_ot === 'terminado') toast.success('¡Orden terminada! Lista para entregar ✓')
    } else {
      const res = await fetch(`/api/dashboard/optica/ordenes/${id}/tareas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error'); setSavingTarea(false); return }
      setTareas(prev => [...prev, data.tarea])
      if (data.nuevo_estado_ot) setEstadoOT(data.nuevo_estado_ot)
    }
    resetTareaForm()
    setSavingTarea(false)
  }

  async function handleCambiarEstadoTarea(tarea: OpticaOrdenTarea, nuevoEstado: EstadoTarea) {
    const res = await fetch(`/api/dashboard/optica/ordenes/${id}/tareas/${tarea.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevoEstado }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error'); return }
    setTareas(prev => prev.map(t => t.id === tarea.id ? data.tarea : t))
    if (data.nuevo_estado_ot) {
      setEstadoOT(data.nuevo_estado_ot)
      if (data.nuevo_estado_ot === 'terminado') toast.success('¡Orden terminada! Lista para entregar ✓')
    }
  }

  async function handleDeleteTarea(tareaId: number) {
    const res = await fetch(`/api/dashboard/optica/ordenes/${id}/tareas/${tareaId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Error'); return }
    setTareas(prev => prev.filter(t => t.id !== tareaId))
    if (data.nuevo_estado_ot) setEstadoOT(data.nuevo_estado_ot)
  }

  function editTarea(tarea: OpticaOrdenTarea) {
    setTareaForm({ titulo: tarea.titulo, descripcion: tarea.descripcion ?? '', estado: tarea.estado, laboratorio_nombre: tarea.laboratorio_nombre ?? '', laboratorio_tipo: tarea.laboratorio_tipo ?? '' })
    setEditingTareaId(tarea.id)
    setShowTareaForm(true)
  }

  // ── Pagos ─────────────────────────────────────────────────────────────────────

  async function handleSavePago() {
    const monto = parseFloat(pagoForm.monto)
    if (isNaN(monto) || monto <= 0) { toast.error('Monto inválido'); return }
    if (!pagoForm.metodo) { toast.error('Seleccioná un método de pago'); return }
    if (pagoForm.metodo === 'NOTA_CREDITO' && !pagoForm.nota_credito_id) { toast.error('Seleccioná una nota de crédito'); return }
    setSavingPago(true)
    const res = await fetch(`/api/dashboard/optica/ordenes/${id}/pago`, {
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
    if (recargoMonto > 0 && orden) {
      setOrden(prev => prev ? { ...prev, total: Math.round((prev.total - (prev as unknown as {recargo_monto?:number}).recargo_monto! + recargoMonto) * 100) / 100 } : prev)
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
    const res = await fetch(`/api/dashboard/optica/ordenes/${id}/cambiar-estado`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: nuevoEstado }),
    })
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error'); return }
    setEstadoOT(nuevoEstado)
    if (nuevoEstado === 'anulado') {
      const r = await fetch(`/api/dashboard/optica/ordenes/${id}`)
      if (r.ok) { const d = await r.json(); setPagos(d.optica_orden_pagos ?? []) }
      toast.success('Orden anulada')
    } else if (nuevoEstado === 'terminado') {
      setTareas(prev => prev.map(t => ({ ...t, estado: 'terminada' as EstadoTarea })))
      toast.success('Orden marcada como terminada')
    } else {
      toast.success('Orden marcada como entregada')
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
          <p className="font-semibold text-gray-800">No puede crear una OT desde esta sucursal</p>
          <p className="text-sm text-gray-500 mt-1">
            Está visualizando otra sucursal. Seleccione su sucursal en el selector para continuar.
          </p>
        </div>
      </div>
    )
  }

  const titulo = isNueva ? 'Nueva orden de trabajo' : (orden?.numero ?? `OT #${id}`)

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-6 py-3 bg-white border-b shadow-sm">
        <button onClick={() => router.push('/dashboard/optica/ordenes')} className="text-gray-500 hover:text-gray-700">
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
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border mt-0.5 ${ESTADO_BADGE[estadoOT]}`}>
              {ESTADO_OPTICA_LABELS[estadoOT]}
            </span>
          )}
        </div>
        {!isNueva && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open(`/dashboard/optica/ordenes/${id}/print`, '_blank')}
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
        )}
        {!esReadonly && (
          <Button onClick={handleGuardar} disabled={saving} size="sm" className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : isNueva ? 'Crear OT' : 'Guardar OT'}
          </Button>
        )}
        {!isNueva && ['pendiente', 'en_proceso', 'en_laboratorio'].includes(estadoOT) && (
          <Button variant="default" size="sm" className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => setConfirmTerminar(true)}>
            <CheckCircle className="w-4 h-4" />
            Terminar
          </Button>
        )}
        {!isNueva && estadoOT === 'terminado' && (
          <Button variant="default" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfirmEntregar(true)}>
            <CheckCircle className="w-4 h-4" />
            Marcar entregado
          </Button>
        )}
        {!isNueva && !esFinalizado && !esAnulado && (
          <Button variant="outline" size="sm" className="gap-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setConfirmAnular(true)}>
            <XCircle className="w-4 h-4" />
            Anular
          </Button>
        )}
      </div>

      {esSoloFechaPrometida && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-sm text-amber-800 flex items-center gap-2">
          <span className="font-semibold">Edición restringida</span>
          <span className="text-amber-700">— Esta orden tiene tareas en curso. Solo podés modificar la fecha prometida de entrega.</span>
        </div>
      )}
      {esFinalizado && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 text-sm text-blue-800 flex items-center gap-2">
          <span className="font-semibold">{estadoOT === 'terminado' ? 'Orden terminada' : 'Orden entregada'}</span>
          <span className="text-blue-700">— Solo lectura.{puedeAgregarPago ? ' Podés registrar el saldo pendiente.' : ''}</span>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-4 space-y-4">

          {/* ── Datos generales + Receta/médico en grid 2 columnas ─── */}
          <div className="grid grid-cols-2 gap-4">

            {/* Datos generales */}
            <section className="bg-white rounded-lg border p-4 space-y-2">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos generales</h2>

              <div className="flex items-center gap-3">
                <span className={lbl}>Fecha</span>
                <Input type="date" className="h-8 text-sm flex-1" value={fecha} onChange={e => setFecha(e.target.value)} disabled={disabledEdit} />
              </div>
              <div className="flex items-center gap-3">
                <span className={lbl}>Fecha prometida</span>
                <Input type="date" className="h-8 text-sm flex-1" value={fechaPrometida} onChange={e => setFechaPrometida(e.target.value)} disabled={esReadonly} />
              </div>
              <div className="flex items-start gap-3">
                <span className={lbl}>Paciente</span>
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
            </section>

            {/* Receta y médico */}
            <section className="bg-white rounded-lg border p-4 space-y-2">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Receta y médico</h2>

              <div className="flex items-start gap-3">
                <span className={lbl}>Médico</span>
                <div className="flex-1 min-w-0">
                  {disabledEdit
                    ? <p className="text-sm text-gray-700 pt-1.5">{medico?.nombre ?? '—'}</p>
                    : <MedicoSearch value={medico} onChange={setMedico} />
                  }
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={lbl}>Médico (libre)</span>
                <Input
                  className="h-8 text-sm flex-1"
                  placeholder="Dr. García (si no está en sistema)"
                  value={medicoNombre}
                  onChange={e => setMedicoNombre(e.target.value)}
                  disabled={disabledEdit}
                />
              </div>
              <div className="flex items-center gap-3">
                <span className={lbl}>Receta adjunta</span>
                <div className="flex-1">
                  {recetaUrl ? (
                    <div className="flex items-center gap-3">
                      <a href={recetaUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                        <FileText className="w-3.5 h-3.5" />
                        Ver receta
                      </a>
                      {!disabledEdit && (
                        <button onClick={() => setRecetaUrl('')} className="text-gray-400 hover:text-red-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : !disabledEdit ? (
                    <label className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-600 hover:text-blue-600">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingReceta ? 'Subiendo...' : 'Subir PDF/imagen'}
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadReceta(f) }}
                        disabled={uploadingReceta}
                      />
                    </label>
                  ) : <p className="text-sm text-gray-400">Sin receta</p>}
                </div>
              </div>
            </section>
          </div>

          {/* ── Graduación ─── */}
          <section className="bg-white rounded-lg border p-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Graduación / Receta</h2>
            <div className="grid grid-cols-2 gap-x-8">
              {/* Tabla graduación */}
              <div className="overflow-x-auto col-span-2 sm:col-span-1">
                <table className="text-sm w-full">
                  <thead>
                    <tr className="text-gray-400 text-xs">
                      <th className="text-left pb-1.5 w-20"></th>
                      <th className="text-center pb-1.5 w-20">Esfera</th>
                      <th className="text-center pb-1.5 w-20">Cilindro</th>
                      <th className="text-center pb-1.5 w-16">Eje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ['lejos_od', 'Lejos OD'],
                      ['lejos_oi', 'Lejos OI'],
                      ['cerca_od', 'Cerca OD'],
                      ['cerca_oi', 'Cerca OI'],
                    ] as [string, string][]).map(([prefix, label]) => (
                      <tr key={prefix}>
                        <td className="py-0.5 pr-2 font-medium text-xs text-gray-600">{label}</td>
                        {(['esfera', 'cilindro', 'eje'] as const).map(field => {
                          const k = `${prefix}_${field}` as keyof typeof grad
                          return (
                            <td key={field} className="py-0.5 px-1">
                              <Input
                                className="h-7 text-center text-xs"
                                placeholder={field === 'eje' ? '0' : '0.00'}
                                value={grad[k]}
                                onChange={e => setGrad(g => ({ ...g, [k]: e.target.value }))}
                                disabled={disabledEdit}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Adición + DP */}
              <div className="flex flex-col gap-2 justify-center pt-2 sm:pt-0">
                <div className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-right text-xs text-gray-500">Adición</span>
                  <Input className="h-7 w-24 text-xs text-center" placeholder="0.00" value={grad.adicion} onChange={e => setGrad(g => ({ ...g, adicion: e.target.value }))} disabled={disabledEdit} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-right text-xs text-gray-500">DP (mm)</span>
                  <Input className="h-7 w-24 text-xs text-center" placeholder="0.00" value={grad.dp} onChange={e => setGrad(g => ({ ...g, dp: e.target.value }))} disabled={disabledEdit} />
                </div>
              </div>
            </div>
          </section>

          {/* ── Artículos ─── */}
          <section className="bg-white rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Artículos</h2>
                {listas.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">Lista:</span>
                    <select
                      className="h-7 text-xs border border-input rounded-md px-2 bg-white"
                      value={listaId ?? ''}
                      onChange={e => setListaId(Number(e.target.value) || null)}
                      disabled={disabledEdit}
                    >
                      {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {!disabledEdit && (
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => addItem('armazon')} className="h-7 gap-1 text-xs text-purple-700 border-purple-200 hover:bg-purple-50">
                    <Plus className="w-3 h-3" />Armazón
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addItem('cristal')} className="h-7 gap-1 text-xs text-cyan-700 border-cyan-200 hover:bg-cyan-50">
                    <Plus className="w-3 h-3" />Cristal
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addItem('tratamiento')} className="h-7 gap-1 text-xs text-amber-700 border-amber-200 hover:bg-amber-50">
                    <Plus className="w-3 h-3" />Tratamiento
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addItem('otro')} className="h-7 gap-1 text-xs">
                    <Plus className="w-3 h-3" />Otro
                  </Button>
                </div>
              )}
            </div>


            {items.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Sin artículos. Usá los botones para agregar armazones, cristales o tratamientos.
              </p>
            ) : (
              <div className="space-y-1.5">
                {items.map(item => (
                  <ItemRow
                    key={item.key}
                    item={item}
                    onChange={(field, value) => updateItem(item.key, field, value)}
                    onRemove={() => setItems(prev => prev.filter(i => i.key !== item.key))}
                    disabled={disabledEdit}
                    listaId={listaId}
                  />
                ))}
              </div>
            )}

            {/* Totales */}
            <div className="border-t pt-3 mt-1 space-y-1.5 text-sm">

              <div className="flex justify-between text-gray-500 text-xs">
                <span>Subtotal artículos</span>
                <span>{formatARS(subtotalItems)}</span>
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
                <span>Subtotal</span>
                <span>{formatARS(subtotal)}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-500 shrink-0">Descuento</span>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number" className="h-7 w-16 text-xs text-right"
                    value={descuentoPct}
                    onChange={e => onDescuentoPctChange(e.target.value)}
                    disabled={disabledEdit} min="0" max="100" step="0.01" placeholder="0"
                  />
                  <span className="text-gray-400 text-xs shrink-0">%  =</span>
                  <Input
                    type="number" className="h-7 w-28 text-xs text-right"
                    value={descuentoMonto}
                    onChange={e => onDescuentoMontoChange(e.target.value)}
                    disabled={disabledEdit} min="0" step="0.01" placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-amber-600 shrink-0">Recargo</span>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number" className="h-7 w-16 text-xs text-right"
                    value={recargoPct}
                    onChange={e => onRecargoPctChangeOT(e.target.value)}
                    disabled={disabledEdit} min="0" max="100" step="0.01" placeholder="0"
                  />
                  <span className="text-gray-400 text-xs shrink-0">%  =</span>
                  <Input
                    type="number" className="h-7 w-28 text-xs text-right text-amber-600"
                    value={recargoMonto > 0 ? recargoMonto : ''}
                    onChange={e => onRecargoMontoChangeOT(e.target.value)}
                    disabled={disabledEdit} min="0" step="0.01" placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex justify-between font-semibold text-sm border-t pt-1.5">
                <span>Total</span>
                <span>{formatARS(totalFinal)}</span>
              </div>

              {/* Seña solo en nueva OT */}
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
                    <Input
                      type="number" className="h-8 flex-1 text-sm text-right"
                      value={anticipo}
                      onChange={e => setAnticipo(e.target.value)}
                      min="0" step="0.01" placeholder="0.00"
                    />
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
                        <Input
                          placeholder="Referencia (opcional)"
                          className="h-7 flex-1 text-xs"
                          value={anticipoRef}
                          onChange={e => setAnticipoRef(e.target.value)}
                        />
                        <Input
                          type="date"
                          className="h-7 w-36 text-xs"
                          value={anticipoFecha}
                          onChange={e => setAnticipoFecha(e.target.value)}
                        />
                      </div>
                    )
                  })()}
                  {anticipoNum > 0 && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Saldo a cobrar</span>
                      <span>{formatARS(saldoAnticipo)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Pagado / Saldo para OT existente */}
              {!isNueva && (
                <div className="space-y-1 border-t pt-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Pagado</span>
                    <span>{formatARS(pagado)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-sm">
                    <span>Saldo pendiente</span>
                    <span className={saldo > 0.005 ? 'text-red-600' : 'text-green-600'}>
                      {formatARS(saldo)}
                    </span>
                  </div>
                </div>
              )}

            </div>
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
                <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/optica/ordenes')}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleGuardar} disabled={saving}>
                  <Save className="w-4 h-4 mr-1.5" />
                  {saving ? 'Guardando...' : isNueva ? 'Crear OT' : 'Guardar OT'}
                </Button>
              </div>
            )}
          </section>

          {/* ── Tareas ─── */}
          {!isNueva && (
            <section className="bg-white rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Tareas
                  {tareas.length > 0 && (
                    <span className="ml-2 font-normal normal-case text-gray-400">
                      {tareas.filter(t => t.estado === 'terminada').length}/{tareas.length} terminadas
                    </span>
                  )}
                </h2>
                {!esAnulado && estadoOT !== 'entregado' && !showTareaForm && (
                  <Button variant="outline" size="sm" onClick={() => setShowTareaForm(true)} className="h-7 gap-1 text-xs">
                    <Plus className="w-3 h-3" />
                    Agregar tarea
                  </Button>
                )}
              </div>

              {showTareaForm && (
                <div className="border rounded-lg p-3 bg-gray-50 space-y-2.5">
                  <div className="flex items-center gap-3">
                    <span className={lbl2}>Título *</span>
                    <Input
                      className="h-8 text-sm flex-1"
                      placeholder="Ej: Pedir cristales, Enviar al laboratorio..."
                      value={tareaForm.titulo}
                      onChange={e => setTareaForm(f => ({ ...f, titulo: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={lbl2}>Estado</span>
                    <Select value={tareaForm.estado} onValueChange={v => setTareaForm(f => ({ ...f, estado: v as EstadoTarea }))}>
                      <SelectTrigger className="h-8 text-sm flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en_proceso">En proceso</SelectItem>
                        <SelectItem value="en_laboratorio">En laboratorio</SelectItem>
                        <SelectItem value="terminada">Terminada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {tareaForm.estado === 'en_laboratorio' && (
                    <>
                      <div className="flex items-center gap-3">
                        <span className={lbl2}>Laboratorio</span>
                        <Input className="h-8 text-sm flex-1" placeholder="Nombre del laboratorio" value={tareaForm.laboratorio_nombre} onChange={e => setTareaForm(f => ({ ...f, laboratorio_nombre: e.target.value }))} />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={lbl2}>Tipo lab.</span>
                        <Select value={tareaForm.laboratorio_tipo} onValueChange={v => setTareaForm(f => ({ ...f, laboratorio_tipo: v as 'propio' | 'externo' | '' }))}>
                          <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="propio">Propio</SelectItem>
                            <SelectItem value="externo">Externo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-3">
                    <span className={lbl2}>Descripción</span>
                    <Input className="h-8 text-sm flex-1" placeholder="Notas adicionales..." value={tareaForm.descripcion} onChange={e => setTareaForm(f => ({ ...f, descripcion: e.target.value }))} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={resetTareaForm}>Cancelar</Button>
                    <Button size="sm" onClick={handleSaveTarea} disabled={savingTarea}>
                      {savingTarea ? 'Guardando...' : editingTareaId ? 'Actualizar' : 'Agregar'}
                    </Button>
                  </div>
                </div>
              )}

              {tareas.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Sin tareas. Agregá la primera para comenzar el seguimiento.</p>
              ) : (
                <div className="space-y-1.5">
                  {tareas.map(tarea => (
                    <div key={tarea.id} className="flex items-start gap-3 p-2.5 rounded-lg border bg-gray-50 hover:bg-white transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{tarea.titulo}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${TAREA_BADGE[tarea.estado]}`}>
                            {tarea.estado === 'en_proceso' ? 'En proceso' : tarea.estado === 'en_laboratorio' ? 'En laboratorio' : 'Terminada'}
                          </span>
                        </div>
                        {tarea.laboratorio_nombre && (
                          <p className="text-xs text-gray-500 mt-0.5">Lab: {tarea.laboratorio_nombre} ({tarea.laboratorio_tipo})</p>
                        )}
                        {tarea.descripcion && <p className="text-xs text-gray-500 mt-0.5">{tarea.descripcion}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{formatFecha(tarea.fecha)}</p>
                      </div>
                      {!esAnulado && estadoOT !== 'entregado' && (
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {tarea.estado !== 'terminada' && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-green-700 hover:bg-green-50" onClick={() => handleCambiarEstadoTarea(tarea, 'terminada')}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Terminar
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editTarea(tarea)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:bg-red-50" onClick={() => handleDeleteTarea(tarea.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

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
                  {/* Método + Monto + Concepto */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16 text-right shrink-0">Método</span>
                      <select
                        className="h-8 text-sm border border-input rounded-md px-2 bg-white flex-1"
                        value={pagoForm.metodo}
                        onChange={e => {
                          const fp = formasPago.find(f => f.nombre === e.target.value)
                          setPagoForm(f => ({
                            ...f,
                            metodo:          e.target.value,
                            forma_pago_id:   fp?.id ?? null,
                            cuotas:          null,
                            nota_credito_id: null,
                            referencia:      '',
                          }))
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
                    {/* Referencia + fecha para tipos bancarios/tarjeta/billetera */}
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
                    {/* Cuotas para tarjeta de crédito */}
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
                                  const base = isNueva ? total : (orden?.total ?? total)
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
                    {/* NC selector */}
                    {pagoForm.metodo === 'NOTA_CREDITO' && (
                      <div className="col-span-2">
                        {!cliente ? (
                          <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">El cliente no tiene NCs — seleccioná un cliente primero</p>
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
        title="Marcar como terminada"
        description="Se marcarán todas las tareas como terminadas. ¿Confirmás?"
        confirmLabel="Sí, terminar"
        variant="default"
      />
      <ConfirmDialog
        open={confirmEntregar}
        onCancel={() => setConfirmEntregar(false)}
        onConfirm={() => { handleCambiarEstado('entregado'); setConfirmEntregar(false) }}
        title="Marcar como entregado"
        description="¿Confirmás que la orden fue entregada al cliente?"
        confirmLabel="Sí, marcar entregado"
        variant="default"
      />
      <ConfirmDialog
        open={confirmAnular}
        onCancel={() => setConfirmAnular(false)}
        onConfirm={() => { handleCambiarEstado('anulado'); setConfirmAnular(false) }}
        title="Anular orden"
        description={`Esta acción es irreversible. Se registrará un asiento de anulación en los pagos de la OT.${saldo > 0.005 ? ` Saldo pendiente: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(saldo)}` : ''} ¿Confirmás?`}
        confirmLabel="Anular"
        variant="destructive"
      />
      <ConfirmDialog
        open={!!confirmImprimirNueva}
        onCancel={() => {
          router.push(`/dashboard/optica/ordenes/${confirmImprimirNueva?.id}`)
          setConfirmImprimirNueva(null)
        }}
        onConfirm={() => {
          if (confirmImprimirNueva) {
            window.open(`/dashboard/optica/ordenes/${confirmImprimirNueva.id}/print`, '_blank')
            router.push(`/dashboard/optica/ordenes/${confirmImprimirNueva.id}`)
          }
          setConfirmImprimirNueva(null)
        }}
        title={`Orden ${confirmImprimirNueva?.numero ?? ''} creada`}
        description="¿Deseas imprimir o generar el PDF de esta orden de trabajo?"
        confirmLabel="Sí, imprimir / PDF"
        variant="default"
      />
    </div>
  )
}
