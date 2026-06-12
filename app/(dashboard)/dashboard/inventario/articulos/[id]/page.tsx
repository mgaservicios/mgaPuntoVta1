'use client'

import { useEffect, useState, use, useCallback, useRef, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Pencil, Trash2, X, Save, Upload, Warehouse, Tag } from 'lucide-react'
import QuickCreateDialog from '../_components/QuickCreateDialog'
import VarianteDialog from '../_components/VarianteDialog'
import PreciosPanel from '../_components/PreciosPanel'
import VariantePreciosDialog from '../_components/VariantePreciosDialog'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type {
  ArticuloWithVariantes, ArticuloVariante, AtributoTipo,
  Categoria, Subcategoria, Marca, UnidadMedida,
} from '@/types/articulos'
import type { PrecioVigente, ListaPrecio } from '@/types/precios'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const articuloSchema = z.object({
  nombre:        z.string().min(1, 'El nombre es obligatorio'),
  codigo:        z.string().min(1, 'El código es obligatorio'),
  descripcion:   z.string().optional(),
  tipo_articulo: z.enum(['simple', 'con_variantes']),
  categoria_id:     z.string().min(1, 'La categoría es obligatoria'),
  subcategoria_id:  z.string().optional(),
  marca_id:         z.string().optional(),
  proveedor_id:  z.string().optional(),
  precio_venta:  z.string().optional(),
  precio_compra: z.string().optional(),
  stock_actual:  z.string().optional(),
  stock_minimo:  z.string().optional(),
  unidad_id:     z.string().optional(),
  codigo_barras: z.string().optional(),
  imagen_url:    z.string().optional(),
  activo:        z.boolean(),
})
type FormValues = z.infer<typeof articuloSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrecio(v: number | null): string {
  if (v == null || v === 0) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v)
}

function toNum(v: string | undefined): number | null {
  if (!v || v.trim() === '') return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function toInt(v: string | undefined): number {
  if (!v || v.trim() === '') return 0
  const n = parseInt(v, 10)
  return isNaN(n) ? 0 : n
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface Proveedor { id: number; nombre: string }

type QuickCreateType = 'categoria' | 'subcategoria' | 'marca' | 'proveedor' | 'unidad' | null

export default function ArticuloFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'nuevo'
  const router = useRouter()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [unidades, setUnidades] = useState<UnidadMedida[]>([])
  const [atributoTipos, setAtributoTipos] = useState<AtributoTipo[]>([])
  const [variantes, setVariantes] = useState<ArticuloVariante[]>([])
  const [varianteDialog, setVarianteDialog] = useState<{
    open: boolean; variante: ArticuloVariante | null
  }>({ open: false, variante: null })
  const [deletingVarianteId, setDeletingVarianteId] = useState<number | null>(null)
  const [quickCreate, setQuickCreate] = useState<QuickCreateType>(null)
  const [showAddAnother, setShowAddAnother] = useState(false)
  const [variantePreciosId, setVariantePreciosId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('basicos')
  const [variantesPrecios, setVariantesPrecios] = useState<Record<number, PrecioVigente[]>>({})
  const [listasTodas, setListasTodas] = useState<ListaPrecio[]>([])
  const [pendingPrecios, setPendingPrecios] = useState<Record<number, string>>({})
  const [manejaVariantes, setManejaVariantes] = useState(true)

  const [stockSucursales, setStockSucursales] = useState<{
    sucursal_id: number
    variante_id: number | null
    stock_actual: number
    stock_minimo: number
    is_active: boolean
    sucursales: { nombre: string }[] | null
  }[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(articuloSchema),
      defaultValues: {
        tipo_articulo: 'simple',
        unidad_id: '',
        activo: true,
        stock_actual: '0',
        stock_minimo: '0',
      },
    })

  const tipoArticulo = watch('tipo_articulo')
  const imagenUrl = watch('imagen_url')

  const cargarPreciosVariantes = useCallback(async (vs: ArticuloVariante[]) => {
    if (vs.length === 0 || isNew) return
    const results = await Promise.all(
      vs.map(v =>
        fetch(`/api/dashboard/articulos/${id}/precios?variante_id=${v.id}`)
          .then(r => r.json() as Promise<{ vigentes: PrecioVigente[] }>)
          .then(d => ({ id: v.id, vigentes: d.vigentes ?? [] }))
      )
    )
    setVariantesPrecios(Object.fromEntries(results.map(r => [r.id, r.vigentes])))
  }, [id, isNew])

  const loadCatalogos = useCallback(async () => {
    const [resCat, resMar, resProv, resAtrib, resUnd, resListas, resParams] = await Promise.all([
      fetch('/api/dashboard/categorias'),
      fetch('/api/dashboard/marcas'),
      fetch('/api/dashboard/proveedores'),
      fetch('/api/dashboard/atributo-tipos'),
      fetch('/api/dashboard/unidades-medida'),
      fetch('/api/dashboard/listas-precio'),
      fetch('/api/dashboard/admin/parametros'),
    ])
    const [cats, mars, provs, atribs, unds, listas, params] = await Promise.all([
      resCat.json(), resMar.json(), resProv.json(), resAtrib.json(), resUnd.json(), resListas.json(), resParams.json(),
    ])
    setCategorias(Array.isArray(cats) ? cats : [])
    setMarcas(Array.isArray(mars) ? mars : [])
    setProveedores(Array.isArray(provs) ? provs : [])
    setAtributoTipos(Array.isArray(atribs) ? atribs : [])
    setUnidades(Array.isArray(unds) ? unds : [])
    setListasTodas((Array.isArray(listas) ? listas : []).filter((l: { activo: boolean }) => l.activo) as ListaPrecio[])
    setManejaVariantes(params['maneja_variantes'] !== 'false')
    return { unds: unds as UnidadMedida[], cats: cats as Categoria[] }
  }, [])

  useEffect(() => {
    loadCatalogos().then(({ unds, cats }) => {
      if (isNew) {
        const defaultUnidad = unds.find((u) => u.nombre.toLowerCase() === 'unidad')
        if (defaultUnidad) setValue('unidad_id', String(defaultUnidad.id))
        const varios = cats.find((c) => c.nombre === 'Varios')
        if (varios) setValue('categoria_id', String(varios.id), { shouldValidate: false })
      }
    })
    if (isNew) {
      fetch('/api/dashboard/articulos/next-code')
        .then((r) => r.json())
        .then(({ codigo }) => setValue('codigo', codigo))
      return
    }
    fetch(`/api/dashboard/articulos/${id}`)
      .then((r) => r.json())
      .then((data: ArticuloWithVariantes) => {
        reset({
          nombre:          data.nombre,
          codigo:          data.codigo ?? '',
          descripcion:     data.descripcion ?? '',
          tipo_articulo:   data.tipo_articulo,
          categoria_id:    data.categoria_id != null ? String(data.categoria_id) : '',
          subcategoria_id: data.subcategoria_id != null ? String(data.subcategoria_id) : '',
          marca_id:        data.marca_id != null ? String(data.marca_id) : '',
          proveedor_id:  data.proveedor_id != null ? String(data.proveedor_id) : '',
          precio_venta:  data.precio_venta != null ? String(data.precio_venta) : '',
          precio_compra: data.precio_compra != null ? String(data.precio_compra) : '',
          stock_actual:  String(data.stock_actual),
          stock_minimo:  String(data.stock_minimo),
          unidad_id:     data.unidad_id != null ? String(data.unidad_id) : '',
          codigo_barras: data.codigo_barras ?? '',
          imagen_url:    data.imagen_url ?? '',
          activo:        data.activo,
        })
        setVariantes(data.articulo_variantes ?? [])
        cargarPreciosVariantes(data.articulo_variantes ?? [])
      })
      .finally(() => setLoading(false))
  }, [id, isNew, reset, loadCatalogos, cargarPreciosVariantes])

  function handlePendingPrecioChange(listaId: number, value: string) {
    setPendingPrecios(prev => {
      const next = { ...prev, [listaId]: value }
      const numVal = Number(value)
      for (const l of listasTodas) {
        if (l.tipo === 'calculada' && l.lista_base_id === listaId && l.porcentaje != null) {
          next[l.id] = numVal > 0 ? (numVal * (1 + Number(l.porcentaje) / 100)).toFixed(2) : ''
        }
      }
      return next
    })
  }

  async function onSubmit(values: FormValues) {
    setSaving(true)
    const payload = {
      nombre:        values.nombre,
      codigo:        values.codigo || undefined,
      descripcion:   values.descripcion || undefined,
      tipo_articulo: values.tipo_articulo,
      categoria_id:     values.categoria_id ? Number(values.categoria_id) : null,
      subcategoria_id:  values.subcategoria_id ? Number(values.subcategoria_id) : null,
      marca_id:         values.marca_id ? Number(values.marca_id) : null,
      proveedor_id:  values.proveedor_id ? Number(values.proveedor_id) : null,
      precio_venta:  toNum(values.precio_venta),
      precio_compra: toNum(values.precio_compra),
      stock_actual:  toInt(values.stock_actual),
      stock_minimo:  toInt(values.stock_minimo),
      unidad_id:     values.unidad_id ? Number(values.unidad_id) : null,
      codigo_barras: values.codigo_barras || undefined,
      imagen_url:    values.imagen_url || undefined,
      activo:        values.activo,
    }

    const res = await fetch(
      isNew ? '/api/dashboard/articulos' : `/api/dashboard/articulos/${id}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    if (res.ok) {
      if (isNew) {
        const created = await res.json()
        const preciosEntries = Object.entries(pendingPrecios).filter(([, v]) => v.trim() !== '' && Number(v) > 0)
        if (preciosEntries.length > 0) {
          await Promise.all(
            preciosEntries.map(([listaId, precio]) =>
              fetch(`/api/dashboard/articulos/${created.id}/precios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lista_precio_id: Number(listaId), precio: Number(precio), origen_tipo: 'manual' }),
              })
            )
          )
        }
        toast.success('Artículo creado')
        setShowAddAnother(true)
      } else {
        toast.success('Artículo actualizado')
      }
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al guardar')
    }
    setSaving(false)
  }

  async function resetForNew() {
    reset({
      nombre: '', codigo: '', descripcion: '',
      tipo_articulo: 'simple',
      categoria_id: '', subcategoria_id: '', marca_id: '', proveedor_id: '',
      precio_venta: '', precio_compra: '',
      stock_actual: '0', stock_minimo: '0',
      unidad_id: '', codigo_barras: '', imagen_url: '',
      activo: true,
    })
    const defaultUnidad = unidades.find((u) => u.nombre.toLowerCase() === 'unidad')
    if (defaultUnidad) setValue('unidad_id', String(defaultUnidad.id))
    const varios = categorias.find((c) => c.nombre === 'Varios')
    if (varios) setValue('categoria_id', String(varios.id), { shouldValidate: false })
    const r = await fetch('/api/dashboard/articulos/next-code')
    const { codigo } = await r.json()
    setValue('codigo', codigo)
    setPendingPrecios({})
    setShowAddAnother(false)
  }

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/dashboard/articulos/upload-image', { method: 'POST', body: fd })
    if (res.ok) {
      const { url } = await res.json()
      setValue('imagen_url', url)
      toast.success('Imagen subida')
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al subir imagen')
    }
    setUploadingImage(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleQuickCreated(type: QuickCreateType, item: { id: number; nombre: string }) {
    if (type === 'categoria') {
      setCategorias((prev) => [...prev, { ...item, activo: true }])
      setValue('categoria_id', String(item.id))
      setValue('subcategoria_id', '')
    } else if (type === 'subcategoria') {
      const categoriaId = Number(watch('categoria_id'))
      setCategorias((prev) =>
        prev.map((c) =>
          c.id === categoriaId
            ? { ...c, subcategorias: [...(c.subcategorias ?? []), { ...item, activo: true, categoria_id: categoriaId }] }
            : c
        )
      )
      setValue('subcategoria_id', String(item.id))
    } else if (type === 'marca') {
      setMarcas((prev) => [...prev, { ...item, activo: true }])
      setValue('marca_id', String(item.id))
    } else if (type === 'proveedor') {
      setProveedores((prev) => [...prev, item])
      setValue('proveedor_id', String(item.id))
    } else if (type === 'unidad') {
      setUnidades((prev) => [...prev, { ...item, activo: true }])
      setValue('unidad_id', String(item.id))
    }
    setQuickCreate(null)
  }

  async function handleDeleteVariante(varianteId: number) {
    setDeletingVarianteId(varianteId)
    const res = await fetch(
      `/api/dashboard/articulos/${id}/variantes/${varianteId}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      toast.success('Variante eliminada')
      setVariantes((prev) => prev.filter((v) => v.id !== varianteId))
    } else {
      toast.error('Error al eliminar variante')
    }
    setDeletingVarianteId(null)
  }

  useEffect(() => {
    if (isNew) return
    fetch(`/api/dashboard/articulos/${id}/stock-sucursales`)
      .then(r => r.json())
      .then(setStockSucursales)
  }, [id, isNew])

  function handleVarianteSaved(v: ArticuloVariante) {
    setVariantes((prev) => {
      const idx = prev.findIndex((x) => x.id === v.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = v
        return next
      }
      return [...prev, v]
    })
    // Recarga solo los precios de esta variante
    fetch(`/api/dashboard/articulos/${id}/precios?variante_id=${v.id}`)
      .then(r => r.json() as Promise<{ vigentes: PrecioVigente[] }>)
      .then(d => setVariantesPrecios(prev => ({ ...prev, [v.id]: d.vigentes ?? [] })))
      .catch(() => {/* silent */})
  }

  function labelAtributos(v: ArticuloVariante) {
    const attrs = v.variante_atributos ?? []
    if (attrs.length === 0) return '—'
    return attrs.map((a) => `${a.atributo_tipos?.nombre ?? '?'}: ${a.valor}`).join(' / ')
  }

  if (loading) return <div className="text-gray-400">Cargando…</div>

  const lbl  = 'w-28 shrink-0 text-right text-xs text-gray-500 leading-none pt-[9px]'
  const lbl2 = 'w-24 shrink-0 text-right text-xs text-gray-500 leading-none'

  const tabList = [
    { id: 'basicos',   label: 'Datos básicos' },
    ...(!isNew && tipoArticulo === 'con_variantes' ? [{ id: 'variantes', label: 'Variantes' }] : []),
    ...(!isNew ? [{ id: 'precios', label: 'Precios' }] : []),
    { id: 'stock', label: 'Stock' },
  ]

  return (
    <div className="max-w-3xl">
      {/* ── Barra sticky ── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-base font-semibold text-gray-900 truncate">
            {isNew ? 'Nuevo artículo' : (watch('nombre') || 'Editar artículo')}
          </h2>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
            <X className="w-4 h-4 mr-1.5" />
            Cancelar
          </Button>
          <Button type="submit" form="articulo-form" size="sm" disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="inline-flex h-9 items-center rounded-lg bg-muted p-0.5 mb-4">
        {tabList.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'inline-flex h-[calc(100%-2px)] items-center justify-center rounded-md px-3 text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Form: envuelve Datos básicos y Stock (ambos siempre en DOM) ── */}
      <form id="articulo-form" onSubmit={handleSubmit(onSubmit)}>

        {/* ══ Tab: Datos básicos ══ */}
        <div className={cn('space-y-3', activeTab !== 'basicos' && 'hidden')}>

          {/* Información básica */}
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Información básica</h3>

            <div className="flex items-start gap-3">
              <span className={lbl}>Nombre *</span>
              <div className="flex-1 min-w-0">
                <Input {...register('nombre')} placeholder="Nombre del artículo" />
                {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre.message}</p>}
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className={lbl}>Código *</span>
                <div className="flex-1 min-w-0">
                  <Input {...register('codigo')} placeholder="ART001" />
                  {errors.codigo
                    ? <p className="text-xs text-red-500 mt-1">{errors.codigo.message}</p>
                    : isNew && <p className="text-xs text-gray-400 mt-1">Auto-generado. Podés editarlo.</p>
                  }
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-500 whitespace-nowrap">Tipo</span>
                <Select
                  value={watch('tipo_articulo')}
                  onValueChange={(v) => setValue('tipo_articulo', v as FormValues['tipo_articulo'])}
                  disabled={!isNew}
                >
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple</SelectItem>
                    {(manejaVariantes || !isNew) && (
                      <SelectItem value="con_variantes">Con variantes</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className={lbl}>Descripción</span>
              <textarea
                {...register('descripcion')}
                rows={2}
                placeholder="Descripción opcional"
                className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>
          </section>

          {/* Clasificación */}
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Clasificación</h3>

            <div className="grid grid-cols-2 gap-x-6">
              <div className="flex items-center gap-2">
                <span className={lbl2}>Categoría *</span>
                <div className="flex gap-1.5 flex-1 min-w-0">
                  <Select
                    value={watch('categoria_id') || ''}
                    onValueChange={(v) => { setValue('categoria_id', v ?? '', { shouldValidate: true }); setValue('subcategoria_id', '') }}
                  >
                    <SelectTrigger className={`flex-1 min-w-0 ${errors.categoria_id ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder="Seleccioná…">{categorias.find(c => String(c.id) === watch('categoria_id'))?.nombre}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>{categorias.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" className="shrink-0" title="Nueva categoría" onClick={() => setQuickCreate('categoria')}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>
              {(() => {
                const filteredSubs: Subcategoria[] = categorias.find(c => String(c.id) === watch('categoria_id'))?.subcategorias ?? []
                return (
                  <div className="flex items-center gap-2">
                    <span className={lbl2}>Subcategoría</span>
                    <div className="flex gap-1.5 flex-1 min-w-0">
                      <Select value={watch('subcategoria_id') || 'none'} onValueChange={(v) => setValue('subcategoria_id', !v || v === 'none' ? '' : v)} disabled={!watch('categoria_id')}>
                        <SelectTrigger className="flex-1 min-w-0">
                          <SelectValue placeholder="Sin subcategoría">{filteredSubs.find(s => String(s.id) === watch('subcategoria_id'))?.nombre}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin subcategoría</SelectItem>
                          {filteredSubs.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" className="shrink-0" title="Nueva subcategoría" disabled={!watch('categoria_id')} onClick={() => setQuickCreate('subcategoria')}><Plus className="w-4 h-4" /></Button>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="grid grid-cols-2 gap-x-6">
              <div className="flex items-center gap-2">
                <span className={lbl2}>Marca</span>
                <div className="flex gap-1.5 flex-1 min-w-0">
                  <Select value={watch('marca_id') || 'none'} onValueChange={(v) => setValue('marca_id', !v || v === 'none' ? '' : v)}>
                    <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder="Sin marca">{marcas.find(m => String(m.id) === watch('marca_id'))?.nombre}</SelectValue></SelectTrigger>
                    <SelectContent><SelectItem value="none">Sin marca</SelectItem>{marcas.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" className="shrink-0" title="Nueva marca" onClick={() => setQuickCreate('marca')}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={lbl2}>Proveedor</span>
                <div className="flex gap-1.5 flex-1 min-w-0">
                  <Select value={watch('proveedor_id') || 'none'} onValueChange={(v) => setValue('proveedor_id', !v || v === 'none' ? '' : v)}>
                    <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder="Sin proveedor">{proveedores.find(p => String(p.id) === watch('proveedor_id'))?.nombre}</SelectValue></SelectTrigger>
                    <SelectContent><SelectItem value="none">Sin proveedor</SelectItem>{proveedores.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" className="shrink-0" title="Nuevo proveedor" onClick={() => setQuickCreate('proveedor')}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6">
              <div className="flex items-center gap-2">
                <span className={lbl2}>Unidad</span>
                <div className="flex gap-1.5 flex-1 min-w-0">
                  <Select value={watch('unidad_id') || 'none'} onValueChange={(v) => setValue('unidad_id', !v || v === 'none' ? '' : v)}>
                    <SelectTrigger className="flex-1 min-w-0"><SelectValue placeholder="Sin unidad">{unidades.find(u => String(u.id) === watch('unidad_id'))?.nombre}</SelectValue></SelectTrigger>
                    <SelectContent><SelectItem value="none">Sin unidad</SelectItem>{unidades.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" className="shrink-0" title="Nueva unidad" onClick={() => setQuickCreate('unidad')}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={lbl2}>Imagen</span>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageUpload} />
                {imagenUrl ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-md overflow-hidden border border-gray-200 shrink-0 bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagenUrl} alt="Imagen" className="w-full h-full object-cover" />
                    </div>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                      <Upload className="w-3.5 h-3.5 mr-1" />{uploadingImage ? 'Subiendo…' : 'Cambiar'}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => setValue('imagen_url', '')}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                    <Upload className="w-3.5 h-3.5 mr-1" />{uploadingImage ? 'Subiendo…' : 'Subir imagen'}
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* Código de barras + Estado (fila compacta al pie) */}
          <section className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-3">
                <span className={lbl2}>Cód. barras</span>
                <Input {...register('codigo_barras')} placeholder="7790000000000" className="w-48" />
              </div>
              {!isNew && (
                <label className="flex items-center gap-2 cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={watch('activo')}
                    onChange={(e) => setValue('activo', e.target.checked)}
                  />
                  <span className="text-sm">Artículo activo</span>
                </label>
              )}
            </div>
          </section>

          {/* Precios iniciales — solo en alta de artículos simples */}
          {isNew && tipoArticulo === 'simple' && listasTodas.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Precios</h3>
              {listasTodas.map((lista) => {
                const isCalculada = lista.tipo === 'calculada'
                return (
                  <div key={lista.id} className="flex items-center gap-3">
                    <span className={`w-36 shrink-0 text-right text-xs leading-none ${isCalculada ? 'text-gray-400' : 'text-gray-500'}`}>
                      {lista.nombre}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className={`w-40 ${isCalculada && !pendingPrecios[lista.id] ? 'text-gray-400 bg-gray-50' : ''}`}
                      value={pendingPrecios[lista.id] ?? ''}
                      onChange={(e) => handlePendingPrecioChange(lista.id, e.target.value)}
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                        {lista.categoria === 'costo' ? 'Costo' : 'Venta'}
                      </span>
                      {isCalculada && (
                        <span className="text-[10px] text-indigo-400 italic">
                          {lista.porcentaje != null ? `+${lista.porcentaje}%` : 'calculado'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
              <p className="text-xs text-gray-400">Opcionales — se registran junto con el artículo.</p>
            </section>
          )}
        </div>

        {/* ══ Tab: Stock ══ */}
        <div className={cn('space-y-3', activeTab !== 'stock' && 'hidden')}>

          {/* Configuración */}
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Configuración</h3>
            <div className="flex items-center gap-3">
              <span className={lbl2}>Stock mín.</span>
              <Input {...register('stock_minimo')} type="number" step="1" className="w-32" />
            </div>
            {isNew && (
              <div className="flex items-center gap-3">
                <span className={lbl2}>Stock inicial</span>
                <Input {...register('stock_actual')} type="number" step="0.001" className="w-32" />
              </div>
            )}
          </section>

          {/* Stock por sucursal — artículos simples */}
          {!isNew && tipoArticulo === 'simple' && (
            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Por sucursal</h3>
              {stockSucursales.filter(r => r.variante_id === null).length > 0 ? (
                <>
                  <div className={`grid gap-2 ${
                    stockSucursales.filter(r => r.variante_id === null).length <= 2 ? 'grid-cols-2' :
                    stockSucursales.filter(r => r.variante_id === null).length <= 4 ? 'grid-cols-3' : 'grid-cols-4'
                  }`}>
                    {stockSucursales.filter(r => r.variante_id === null).map((row, i) => {
                      const nombre = row.sucursales?.[0]?.nombre ?? `Sucursal #${row.sucursal_id}`
                      const bajo = row.stock_actual <= 0
                      return (
                        <div key={i} className={`space-y-0.5 rounded-lg p-3 border ${row.is_active ? 'border-indigo-200 bg-indigo-50/40' : 'border-gray-100 bg-gray-50/50'}`}>
                          <p className={`text-xs font-medium truncate ${row.is_active ? 'text-indigo-700' : 'text-gray-500'}`}>
                            {nombre}{row.is_active && <span className="ml-1 font-normal text-indigo-400">(activa)</span>}
                          </p>
                          <p className={`text-xl font-bold tabular-nums leading-none ${bajo ? 'text-red-600' : 'text-gray-800'}`}>
                            {Number(row.stock_actual).toLocaleString('es-AR')}
                          </p>
                          {row.stock_minimo > 0 && <p className="text-xs text-gray-400">Mín: {row.stock_minimo}</p>}
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-400">Gestionado desde Movimientos de Stock.</p>
                </>
              ) : (
                <p className="text-sm text-gray-400">Sin stock registrado.</p>
              )}
            </section>
          )}

          {/* Stock variante × sucursal — artículos con variantes */}
          {!isNew && tipoArticulo === 'con_variantes' && stockSucursales.length > 0 && (() => {
            const sucMap = new Map<number, { id: number; nombre: string; is_active: boolean }>()
            for (const r of stockSucursales) {
              if (!sucMap.has(r.sucursal_id))
                sucMap.set(r.sucursal_id, { id: r.sucursal_id, nombre: r.sucursales?.[0]?.nombre ?? `Sucursal #${r.sucursal_id}`, is_active: r.is_active })
            }
            const sucList = Array.from(sucMap.values()).sort((a, b) => {
              if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
              return a.nombre.localeCompare(b.nombre, 'es')
            })
            const stockMap = new Map<string, number>()
            for (const r of stockSucursales) {
              if (r.variante_id != null) stockMap.set(`${r.variante_id}-${r.sucursal_id}`, r.stock_actual)
            }
            return (
              <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-gray-500" />
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Por variante y sucursal</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500">Variante</th>
                        {sucList.map((s) => (
                          <th key={s.id} className={`text-right py-2 px-3 text-xs font-medium whitespace-nowrap ${s.is_active ? 'text-indigo-700' : 'text-gray-400'}`}>
                            {s.nombre}
                            {s.is_active && <span className="block text-[10px] font-normal text-indigo-400 leading-none mt-0.5">activa</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {variantes.map((v) => (
                        <tr key={v.id} className={`hover:bg-gray-50/60 ${!v.activo ? 'opacity-50' : ''}`}>
                          <td className="py-2.5 pr-4 text-gray-700 font-medium">{labelAtributos(v)}</td>
                          {sucList.map((s) => {
                            const stock = stockMap.get(`${v.id}-${s.id}`) ?? 0
                            return (
                              <td key={s.id} className={`py-2.5 px-3 text-right tabular-nums font-medium ${stock <= 0 ? (s.is_active ? 'text-red-600' : 'text-red-300') : (s.is_active ? 'text-gray-900' : 'text-gray-400')}`}>
                                {stock}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400">Gestionado desde Movimientos de Stock.</p>
              </section>
            )
          })()}
        </div>
      </form>

      {/* ══ Tab: Variantes (fuera del form — gestiona su propio estado) ══ */}
      {!isNew && tipoArticulo === 'con_variantes' && (
        <div className={cn(activeTab !== 'variantes' && 'hidden')}>
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Variantes</h3>
              <Button size="sm" onClick={() => setVarianteDialog({ open: true, variante: null })}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar variante
              </Button>
            </div>
            {variantes.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Sin variantes. Agregá la primera.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {variantes.map((v) => {
                  const pvs = variantesPrecios[v.id]
                  const ventaPrecios = pvs?.filter(pv => pv.lista_precio?.categoria === 'venta') ?? []
                  return (
                    <div key={v.id} className={`py-3 ${!v.activo ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{labelAtributos(v)}</p>
                          <p className="text-xs text-gray-400">
                            {v.sku ? `SKU: ${v.sku}` : 'Sin SKU'}
                            {v.codigo_barras ? ` · ${v.codigo_barras}` : ''}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 shrink-0">Stock: {v.stock_actual}</p>
                        <Badge variant={v.activo ? 'default' : 'secondary'} className="shrink-0">
                          {v.activo ? 'Activa' : 'Inactiva'}
                        </Badge>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" title="Gestionar precios" onClick={() => setVariantePreciosId(v.id)}>
                            <Tag className="w-3.5 h-3.5 text-indigo-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setVarianteDialog({ open: true, variante: v })}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteVariante(v.id)} disabled={deletingVarianteId === v.id}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {ventaPrecios.length > 0 && (
                        <div className="flex gap-4 mt-1.5 flex-wrap">
                          {ventaPrecios.map(pv => {
                            const precio = pv.precio_calculado ?? pv.precio
                            return (
                              <span key={pv.lista_precio_id} className="text-xs">
                                <span className="text-gray-400">{pv.lista_precio?.nombre}:</span>{' '}
                                <span className={precio > 0 ? (pv.heredado ? 'text-gray-500' : 'text-gray-800 font-semibold') : 'text-gray-400'}>
                                  {formatPrecio(precio > 0 ? precio : null)}
                                </span>
                                {pv.heredado && <span className="text-gray-400 ml-1 italic">(base)</span>}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ══ Tab: Precios (fuera del form — gestiona su propio estado) ══ */}
      {!isNew && (
        <div className={cn(activeTab !== 'precios' && 'hidden')}>
          <PreciosPanel
            articuloId={Number(id)}
            tieneVariantes={tipoArticulo === 'con_variantes'}
          />
        </div>
      )}

      {/* ── Dialogs (siempre montados) ── */}
      {variantePreciosId !== null && (
        <VariantePreciosDialog
          open={variantePreciosId !== null}
          onClose={() => {
            setVariantePreciosId(null)
            cargarPreciosVariantes(variantes)
          }}
          articuloId={Number(id)}
          varianteId={variantePreciosId}
          varianteLabel={labelAtributos(variantes.find((v) => v.id === variantePreciosId)!)}
        />
      )}

      <QuickCreateDialog open={quickCreate === 'categoria'} title="categoría" apiPath="/api/dashboard/categorias" onClose={() => setQuickCreate(null)} onCreated={(item) => handleQuickCreated('categoria', item)} />
      <QuickCreateDialog open={quickCreate === 'subcategoria'} title="subcategoría" apiPath="/api/dashboard/subcategorias" extraBody={{ categoria_id: watch('categoria_id') ? Number(watch('categoria_id')) : undefined }} onClose={() => setQuickCreate(null)} onCreated={(item) => handleQuickCreated('subcategoria', item)} />
      <QuickCreateDialog open={quickCreate === 'marca'} title="marca" apiPath="/api/dashboard/marcas" onClose={() => setQuickCreate(null)} onCreated={(item) => handleQuickCreated('marca', item)} />
      <QuickCreateDialog open={quickCreate === 'proveedor'} title="proveedor" apiPath="/api/dashboard/proveedores" onClose={() => setQuickCreate(null)} onCreated={(item) => handleQuickCreated('proveedor', item)} />
      <QuickCreateDialog open={quickCreate === 'unidad'} title="unidad de medida" apiPath="/api/dashboard/unidades-medida" onClose={() => setQuickCreate(null)} onCreated={(item) => handleQuickCreated('unidad', item)} />

      <Dialog open={showAddAnother} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader><DialogTitle>Artículo guardado</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">¿Querés agregar otro artículo?</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => router.push('/dashboard/inventario/articulos')}>No, volver a la lista</Button>
            <Button onClick={resetForNew}>Sí, agregar otro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VarianteDialog
        open={varianteDialog.open}
        variante={varianteDialog.variante}
        atributoTipos={atributoTipos}
        articuloId={Number(id)}
        articuloCodigo={watch('codigo') ?? ''}
        onClose={() => setVarianteDialog({ open: false, variante: null })}
        onSaved={handleVarianteSaved}
      />
    </div>
  )
}
