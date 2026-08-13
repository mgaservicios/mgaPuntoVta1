'use client'

import { useState, useEffect, useRef, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Search, X, Plus, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { usePermissions } from '@/components/PermissionsProvider'
import ArticuloQuickCreateDialog from '../../../articulos/_components/ArticuloQuickCreateDialog'
import type { Remito, RemitoItem } from '@/types/stock'
import type { ListaPrecio } from '@/types/precios'

type RemitoDetail = Remito & { sucursal_nombre: string; contraparte_display: string }

type VarianteOption = { id: number; sku: string | null; label: string }

type ItemForm = {
  _key: string
  articulo_id: number
  articulo_nombre: string
  articulo_codigo: string | null
  variante_id: number | null
  variante_sku: string | null
  cantidad: number
  costo_unitario: number | null
  // Para artículos nuevos con variantes
  tipo_articulo: 'simple' | 'con_variantes'
  variantes_list: VarianteOption[]
  // Precios por lista (vigentes, editables)
  precios: Record<number, string>
  loadingPrecios: boolean
}

type ArticuloResult = {
  id: number
  codigo: string | null
  nombre: string
  tipo_articulo: 'simple' | 'con_variantes'
}

const ESTADO_LABELS: Record<string, string> = { borrador: 'Borrador', confirmado: 'Confirmado', anulado: 'Anulado' }
const TIPO_LABELS: Record<string, string> = { entrada: 'Entrada', salida: 'Salida' }

export default function EditarRemitoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [remito, setRemito] = useState<RemitoDetail | null>(null)
  const [items, setItems] = useState<ItemForm[]>([])
  const [nroExterno, setNroExterno] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ArticuloResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [showNewArticulo, setShowNewArticulo] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [cantidadesDecimales, setCantidadesDecimales] = useState(false)
  const [listasTodas, setListasTodas] = useState<ListaPrecio[]>([])

  const { can } = usePermissions()

  useEffect(() => {
    fetch('/api/dashboard/admin/parametros').then(r => r.json()).then(p => setCantidadesDecimales(p['cantidades_decimales'] === 'true')).catch(() => {})
    fetch('/api/dashboard/listas-precio').then(r => r.json()).then(d => setListasTodas(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const compraLista = listasTodas.find(l => l.categoria === 'costo' && l.tipo === 'manual' && l.activo)

  function buildPreciosMap(vigentes: Array<{ lista_precio_id: number; precio: number; precio_calculado?: number }>): Record<number, string> {
    const map: Record<number, string> = {}
    for (const pv of vigentes) {
      const val = pv.precio_calculado ?? pv.precio
      if (val > 0) map[pv.lista_precio_id] = String(val)
    }
    return map
  }

  async function fetchPrecios(articuloId: number, varianteId: number | null): Promise<Record<number, string>> {
    const url = varianteId
      ? `/api/dashboard/articulos/${articuloId}/precios?variante_id=${varianteId}`
      : `/api/dashboard/articulos/${articuloId}/precios`
    const res = await fetch(url)
    if (!res.ok) return {}
    const data = await res.json()
    return buildPreciosMap(data.vigentes ?? [])
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/dashboard/stock/remitos/${id}`).then(r => r.json()),
      fetch('/api/dashboard/listas-precio').then(r => r.json()).catch(() => null),
    ]).then(([data, lis]) => {
      setRemito(data)
      setNroExterno(data.nro_externo ?? '')
      setObservaciones(data.observaciones ?? '')
      const listas = Array.isArray(lis) ? lis as ListaPrecio[] : []
      setListasTodas(listas)
      const compraId = listas.find(l => l.categoria === 'costo' && l.tipo === 'manual' && l.activo)?.id
      const loaded: ItemForm[] = (data.remito_items ?? []).map((item: RemitoItem) => {
        const preciosSeed: Record<number, string> = {}
        for (const pe of (item.precios_extras ?? [])) {
          if (pe?.precio > 0) preciosSeed[pe.lista_precio_id] = String(pe.precio)
        }
        return {
          _key: crypto.randomUUID(),
          articulo_id: item.articulo_id,
          articulo_nombre: item.articulos?.nombre ?? `#${item.articulo_id}`,
          articulo_codigo: item.articulos?.codigo ?? null,
          variante_id: item.variante_id,
          variante_sku: item.articulo_variantes?.sku ?? null,
          cantidad: item.cantidad,
          costo_unitario: item.costo_unitario,
          tipo_articulo: item.variante_id !== null ? 'con_variantes' : 'simple',
          variantes_list: [],
          precios: preciosSeed,
          loadingPrecios: true,
        }
      })
      setItems(loaded)
      setLoading(false)
      // Cargar precios vigentes por ítem; inicializar con lo guardado si existe
      for (const it of loaded) {
        fetchPrecios(it.articulo_id, it.variante_id).then(vigentes => {
          setItems(prev => prev.map(i => {
            if (i._key !== it._key) return i
            const precios = { ...i.precios, ...vigentes }
            // Seed: costo_unitario → lista compra
            if (compraId && it.costo_unitario != null && !precios[compraId]) {
              precios[compraId] = String(it.costo_unitario)
            }
            return { ...i, precios, loadingPrecios: false }
          }))
        })
      }
    }).catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q)
    clearTimeout(debounceRef.current)
    if (!q.trim()) { setSearchResults([]); setShowResults(false); return }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/dashboard/articulos?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSearchResults(Array.isArray(data) ? data.slice(0, 8) : [])
      setShowResults(true)
    }, 300)
  }, [])

  async function addArticulo(art: ArticuloResult) {
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)

    // Evitar duplicados del mismo artículo simple
    if (art.tipo_articulo === 'simple') {
      const existe = items.find(i => i.articulo_id === art.id && i.variante_id === null)
      if (existe) {
        setItems(prev => prev.map(i =>
          i._key === existe._key ? { ...i, cantidad: i.cantidad + 1 } : i
        ))
        return
      }
    }

    const _key = crypto.randomUUID()
    let variantes_list: VarianteOption[] = []

    if (art.tipo_articulo === 'con_variantes') {
      const res = await fetch(`/api/dashboard/articulos/${art.id}`)
      const data = await res.json()
      variantes_list = (data.articulo_variantes ?? []).map((v: {
        id: number; sku: string | null
        variante_atributos?: { atributo_tipos?: { nombre: string }; valor: string }[]
      }) => ({
        id: v.id,
        sku: v.sku,
        label: (v.variante_atributos ?? []).length > 0
          ? (v.variante_atributos ?? []).map(a => `${a.atributo_tipos?.nombre ?? ''}: ${a.valor}`).join(', ')
          : (v.sku || `Variante ${v.id}`),
      }))
    }

    const primerVarianteId = art.tipo_articulo === 'simple' ? null : (variantes_list[0]?.id ?? null)

    setItems(prev => [...prev, {
      _key,
      articulo_id: art.id,
      articulo_nombre: art.nombre,
      articulo_codigo: art.codigo,
      variante_id: primerVarianteId,
      variante_sku: art.tipo_articulo === 'simple' ? null : (variantes_list[0]?.sku ?? null),
      cantidad: 1,
      costo_unitario: null,
      tipo_articulo: art.tipo_articulo,
      variantes_list,
      precios: {},
      loadingPrecios: true,
    }])

    const precios = await fetchPrecios(art.id, primerVarianteId)
    setItems(prev => prev.map(i => i._key === _key ? { ...i, precios, loadingPrecios: false } : i))
  }

  function updateItem(key: string, patch: Partial<ItemForm>) {
    setItems(prev => prev.map(i => i._key === key ? { ...i, ...patch } : i))
  }

  async function handleVarianteChange(key: string, varianteId: number) {
    setItems(prev => prev.map(i => {
      if (i._key !== key) return i
      const v = i.variantes_list.find(vv => vv.id === varianteId)
      return { ...i, variante_id: varianteId, variante_sku: v?.sku ?? null, loadingPrecios: true }
    }))
    const item = items.find(i => i._key === key)
    if (item) {
      const precios = await fetchPrecios(item.articulo_id, varianteId)
      setItems(prev => prev.map(i => i._key === key ? { ...i, precios, loadingPrecios: false } : i))
    }
  }

  // Actualiza el precio de una lista y auto-calcula listas derivadas
  function updateItemPrecio(key: string, listaId: number, value: string) {
    setItems(prev => prev.map(i => {
      if (i._key !== key) return i
      const newPrecios = { ...i.precios, [listaId]: value }
      const numVal = Number(value)
      for (const l of listasTodas) {
        if (l.tipo === 'calculada' && l.lista_base_id === listaId && l.porcentaje != null) {
          newPrecios[l.id] = numVal > 0 ? (numVal * (1 + Number(l.porcentaje) / 100)).toFixed(2) : ''
        }
      }
      return { ...i, precios: newPrecios }
    }))
  }

  function removeItem(key: string) {
    setItems(prev => prev.filter(i => i._key !== key))
  }

  async function handleSave() {
    if (items.length === 0) { toast.error('El remito debe tener al menos un ítem'); return }
    const missingVariante = items.find(i => i.tipo_articulo === 'con_variantes' && !i.variante_id)
    if (missingVariante) {
      toast.error(`Seleccioná una variante para: ${missingVariante.articulo_nombre}`); return
    }

    setSaving(true)
    const esEntrada = remito?.tipo === 'entrada'
    const res = await fetch(`/api/dashboard/stock/remitos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        observaciones: observaciones || null,
        nro_externo: nroExterno.trim() || null,
        items: items.map(i => {
          const costoVal = esEntrada && compraLista ? (Number(i.precios[compraLista.id]) || null) : i.costo_unitario
          return {
            articulo_id: i.articulo_id,
            variante_id: i.variante_id,
            cantidad: i.cantidad,
            costo_unitario: costoVal,
            precios_extras: Object.entries(i.precios)
              .filter(([lid, v]) => v.trim() !== '' && Number(v) > 0 && Number(lid) !== compraLista?.id)
              .map(([lid, precio]) => ({ lista_precio_id: Number(lid), precio: Number(precio) })),
          }
        }),
      }),
    })
    setSaving(false)

    if (res.ok) {
      toast.success(remito?.estado === 'confirmado' ? 'Remito actualizado — stock ajustado' : 'Remito actualizado')
      router.push(`/dashboard/inventario/remitos/${id}`)
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al guardar')
    }
  }

  if (loading) return <div className="text-gray-400 text-sm">Cargando…</div>
  if (!remito) return <div className="text-red-500 text-sm">Remito no encontrado</div>
  if (remito.estado === 'anulado') return <div className="text-red-500 text-sm">No se puede editar un remito anulado</div>

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => router.push('/dashboard/inventario/remitos')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 font-mono">{remito.numero}</h2>
        <Badge variant={remito.tipo === 'entrada' ? 'default' : 'secondary'}>{TIPO_LABELS[remito.tipo]}</Badge>
        <Badge variant={remito.estado === 'confirmado' ? 'default' : 'outline'}>{ESTADO_LABELS[remito.estado]}</Badge>
      </div>

      {/* Aviso para confirmados */}
      {remito.estado === 'confirmado' && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Este remito ya fue confirmado. Los cambios en ítems ajustarán el stock automáticamente.
            {remito.tipo === 'salida' && remito.contraparte_tipo === 'sucursal' && (
              <> También se actualizará el remito de entrada en la sucursal destino.</>
            )}
          </span>
        </div>
      )}

      <div className="space-y-5">
        {/* Info (readonly) */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Sucursal</p>
            <p className="font-medium text-gray-800">{remito.sucursal_nombre}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{remito.tipo === 'entrada' ? 'Origen' : 'Destino'}</p>
            <p className="font-medium text-gray-800">{remito.contraparte_display}</p>
          </div>
        </div>

        {/* Ítems */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Ítems</h3>

          <div className="flex gap-2 mb-4">
            <div ref={searchRef} className="relative flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Buscar artículo para agregar…"
                  className="pl-9"
                />
              </div>
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
                  {searchResults.map(art => (
                    <button
                      key={art.id}
                      type="button"
                      onMouseDown={() => addArticulo(art)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between text-sm border-b border-gray-100 last:border-0"
                    >
                      <span className="font-medium text-gray-800">{art.nombre}</span>
                      <span className="text-gray-400 text-xs font-mono ml-2">{art.codigo ?? ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {can('inventario.articulos.crear') && (
              <Button type="button" variant="outline" onClick={() => setShowNewArticulo(true)} className="shrink-0">
                <Plus className="w-4 h-4 mr-1.5" />
                Agregar nuevo
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg">
              Sin ítems — buscá un artículo para agregar
            </p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[11px] font-medium text-gray-500 min-w-max">
                <span className="w-44 shrink-0">Artículo</span>
                <span className="w-24 shrink-0">SKU / Variante</span>
                <span className="w-16 shrink-0 text-center">Cant.</span>
                {remito.tipo === 'entrada' && listasTodas.map(lista => (
                  <span key={lista.id} className={`w-24 shrink-0 text-center ${lista.categoria === 'costo' ? 'text-amber-600' : ''}`}>
                    {lista.nombre}
                    {lista.tipo === 'calculada' && lista.porcentaje != null && (
                      <span className="ml-1 font-normal text-gray-400">+{lista.porcentaje}%</span>
                    )}
                  </span>
                ))}
                <span className="w-6 shrink-0" />
              </div>
              <div className="divide-y divide-gray-100">
                {items.map(item => (
                  <div key={item._key} className="flex items-center gap-2 px-3 py-2 min-w-max">

                    <div className="w-44 shrink-0 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.articulo_nombre}</p>
                      {item.articulo_codigo && (
                        <p className="text-[11px] text-gray-400 font-mono">{item.articulo_codigo}</p>
                      )}
                      {/* Selector de variante solo para ítems nuevos */}
                      {item.tipo_articulo === 'con_variantes' && item.variantes_list.length > 0 && (
                        <select
                          value={item.variante_id ?? ''}
                          onChange={e => handleVarianteChange(item._key, Number(e.target.value))}
                          className="mt-0.5 text-[11px] border border-gray-200 rounded px-1.5 py-0.5 w-full bg-white"
                        >
                          {item.variantes_list.map(v => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="w-24 shrink-0 text-xs text-gray-500 font-mono truncate">
                      {item.variante_sku ?? (item.variante_id ? `#${item.variante_id}` : '—')}
                    </div>

                    <input
                      type="number"
                      min="1"
                      step={cantidadesDecimales ? '0.001' : '1'}
                      value={item.cantidad}
                      onChange={e => updateItem(item._key, { cantidad: cantidadesDecimales ? parseFloat(e.target.value) || 1 : parseInt(e.target.value, 10) || 1 })}
                      className="w-16 shrink-0 text-center border border-gray-200 rounded px-1.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    {remito.tipo === 'entrada' && (
                      item.loadingPrecios
                        ? <span className="text-[11px] text-gray-400 w-24 shrink-0">Cargando…</span>
                        : listasTodas.map(lista => (
                          <input
                            key={lista.id}
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.precios[lista.id] ?? ''}
                            onChange={e => updateItemPrecio(item._key, lista.id, e.target.value)}
                            placeholder="0.00"
                            className={`w-24 shrink-0 text-center text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-1 ${
                              lista.categoria === 'costo'
                                ? 'border-amber-200 focus:ring-amber-400 bg-amber-50/30'
                                : 'border-gray-200 focus:ring-indigo-400'
                            }`}
                          />
                        ))
                    )}

                    <button
                      type="button"
                      onClick={() => removeItem(item._key)}
                      className="w-6 shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Factura/Remito + Observaciones */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Factura/Remito</label>
            <Input
              value={nroExterno}
              onChange={e => setNroExterno(e.target.value)}
              placeholder="Nro. externo (opcional)"
              className="w-56"
            />
          </div>
          <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Notas adicionales…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-6">
          <Button variant="outline" onClick={() => router.push('/dashboard/inventario/remitos')}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {showNewArticulo && (
        <ArticuloQuickCreateDialog
          open={showNewArticulo}
          onOpenChange={setShowNewArticulo}
          onCreated={(art) => { setShowNewArticulo(false); addArticulo(art) }}
        />
      )}
    </div>
  )
}
