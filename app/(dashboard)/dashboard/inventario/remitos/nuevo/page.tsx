'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Search, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Sucursal } from '@/types/sucursales'
import type { Proveedor } from '@/types/proveedores'
import type { ContraparteTipo, TipoRemito } from '@/types/stock'
import type { ListaPrecio } from '@/types/precios'
import { useSucursalActiva } from '@/hooks/useSucursalActiva'
import { useVendedores } from '@/hooks/useVendedores'
import ProveedorSearch from '@/components/dashboard/ProveedorSearch'

type ArticuloResult = {
  id: number
  codigo: string | null
  nombre: string
  tipo_articulo: 'simple' | 'con_variantes'
}

type VarianteOption = {
  id: number
  sku: string | null
  label: string
}

type ItemForm = {
  _key: string
  articulo_id: number
  articulo_nombre: string
  articulo_codigo: string | null
  tipo_articulo: 'simple' | 'con_variantes'
  variante_id: number | null
  cantidad: number
  precios: Record<number, string>   // lista_precio_id → value string
  loadingPrecios: boolean
  variantes_list: VarianteOption[]
}

export default function NuevoRemitoPage() {
  const router = useRouter()
  const { nombre: sucursalNombre, isHome } = useSucursalActiva()

  const vendedores = useVendedores()
  const [vendedorId, setVendedorId] = useState<number | null>(null)

  const [tipo, setTipo] = useState<TipoRemito>('entrada')
  const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 10))
  const [contraparteTipo, setContraparteTipo] = useState<ContraparteTipo>('proveedor')
  const [contraparteSucursalId, setContraparteSucursalId] = useState<string>('')
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null)
  const [proveedorError, setProveedorError] = useState(false)
  const [sucursalError, setSucursalError] = useState(false)
  const [contraparteNombre, setContraparteNombre] = useState('')
  const [nroExterno, setNroExterno] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState<ItemForm[]>([])
  const [saving, setSaving] = useState(false)
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [savedRemitoId, setSavedRemitoId] = useState<number | null>(null)
  const [savedItems, setSavedItems] = useState<ItemForm[]>([])
  const [confirmingNew, setConfirmingNew] = useState(false)

  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [listasTodas, setListasTodas] = useState<ListaPrecio[]>([])

  // Lista de costo (Compra) — su ID va al campo costo_unitario del remito
  const compraLista = useMemo(
    () => listasTodas.find(l => l.categoria === 'costo' && l.tipo === 'manual'),
    [listasTodas]
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ArticuloResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    fetch('/api/dashboard/sucursales').then(r => r.json()).then(d => setSucursales(Array.isArray(d) ? d : []))
    fetch('/api/dashboard/listas-precio').then(r => r.json()).then(d => setListasTodas(Array.isArray(d) ? d.filter((l: ListaPrecio) => l.activo) : []))
  }, [])

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

  async function addArticulo(art: ArticuloResult) {
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)

    const _key = crypto.randomUUID()
    let variantes_list: VarianteOption[] = []
    if (art.tipo_articulo === 'con_variantes') {
      const res = await fetch(`/api/dashboard/articulos/${art.id}`)
      const data = await res.json()
      variantes_list = (data.articulo_variantes ?? []).map((v: {
        id: number; sku: string | null;
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

    // Agregar item con loading, luego cargar precios
    setItems(prev => [...prev, {
      _key,
      articulo_id: art.id,
      articulo_nombre: art.nombre,
      articulo_codigo: art.codigo,
      tipo_articulo: art.tipo_articulo,
      variante_id: primerVarianteId,
      cantidad: 1,
      precios: {},
      loadingPrecios: true,
      variantes_list,
    }])

    const precios = await fetchPrecios(art.id, primerVarianteId)
    setItems(prev => prev.map(i => i._key === _key ? { ...i, precios, loadingPrecios: false } : i))
  }

  function updateItem(key: string, patch: Partial<ItemForm>) {
    setItems(prev => prev.map(i => i._key === key ? { ...i, ...patch } : i))
  }

  async function handleVarianteChange(key: string, articuloId: number, varianteId: number) {
    updateItem(key, { variante_id: varianteId, loadingPrecios: true })
    const precios = await fetchPrecios(articuloId, varianteId)
    setItems(prev => prev.map(i => i._key === key ? { ...i, precios, loadingPrecios: false } : i))
  }

  // Actualiza el precio de una lista y auto-calcula listas derivadas
  function updateItemPrecio(key: string, listaId: number, value: string) {
    setItems(prev => prev.map(i => {
      if (i._key !== key) return i
      const newPrecios = { ...i.precios, [listaId]: value }
      const numVal = Number(value)
      // Si la lista editada es manual, actualizar sus calculadas derivadas
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

  async function handleSubmit() {
    if (items.length === 0) { toast.error('Agregá al menos un ítem'); return }

    if (contraparteTipo === 'sucursal' && !contraparteSucursalId) {
      toast.error('Seleccioná la sucursal de origen/destino')
      setSucursalError(true)
      return
    }
    if (contraparteTipo === 'proveedor' && !selectedProveedor) {
      setProveedorError(true)
      toast.error('Seleccioná el proveedor'); return
    }
    if (contraparteTipo === 'persona' && !contraparteNombre.trim()) {
      toast.error('Ingresá el nombre de la persona'); return
    }
    const missingVariante = items.find(i => i.tipo_articulo === 'con_variantes' && !i.variante_id)
    if (missingVariante) {
      toast.error(`Seleccioná una variante para: ${missingVariante.articulo_nombre}`); return
    }

    setSaving(true)
    const res = await fetch('/api/dashboard/stock/remitos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo,
        contraparte_tipo: contraparteTipo,
        contraparte_sucursal_id: contraparteTipo === 'sucursal' ? Number(contraparteSucursalId) : null,
        contraparte_proveedor_id: contraparteTipo === 'proveedor' ? selectedProveedor?.id ?? null : null,
        contraparte_nombre: contraparteTipo === 'persona' ? contraparteNombre.trim() : null,
        fecha: new Date(fecha + 'T12:00:00').toISOString(),
        observaciones: observaciones || null,
        nro_externo: nroExterno.trim() || null,
        vendedor_id: vendedorId,
        items: items.map(i => {
          const costoVal = compraLista ? (Number(i.precios[compraLista.id]) || null) : null
          return {
            articulo_id: i.articulo_id,
            variante_id: i.variante_id,
            cantidad: i.cantidad,
            costo_unitario: tipo === 'entrada' ? costoVal : null,
          }
        }),
      }),
    })
    setSaving(false)

    if (res.ok) {
      const data = await res.json()
      toast.success('Remito guardado como borrador')
      setSavedRemitoId(data.id)
      setSavedItems(items)
      setShowConfirmDialog(true)
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al guardar')
    }
  }

  if (!isHome) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <p className="font-semibold text-gray-800">No puede crear un remito desde esta sucursal</p>
          <p className="text-sm text-gray-500 mt-1">
            Está visualizando otra sucursal. Seleccione su sucursal en el selector para continuar.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => setShowExitDialog(true)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800">Nuevo remito</h2>
          {sucursalNombre && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200">
              {sucursalNombre}
            </span>
          )}
        </div>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar como borrador'}
        </Button>
      </div>

      <div className="space-y-5">
        {/* Info + Origen/Destino — una sola card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">

          {/* Fila 1: Tipo · Fecha · Vendedor */}
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 shrink-0">Tipo</span>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(['entrada', 'salida'] as TipoRemito[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={cn(
                      'px-4 py-1.5 text-sm font-medium transition-colors',
                      tipo === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
                      t === 'salida' && 'border-l border-gray-200'
                    )}
                  >
                    {t === 'entrada' ? 'Entrada' : 'Salida'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 shrink-0">Fecha</span>
              <Input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-36 h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 shrink-0">Vendedor</span>
              <Select value={vendedorId?.toString() ?? ''} onValueChange={v => setVendedorId(Number(v))}>
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="Seleccionar…" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores.map(v => (
                    <SelectItem key={v.id} value={v.id.toString()}>{v.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Fila 2: Origen / Destino */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 w-28 shrink-0">
              {tipo === 'entrada' ? 'Origen' : 'Destino'}
            </span>
            <div className="flex gap-2 flex-1">
              <Select
                value={contraparteTipo}
                onValueChange={(v) => { if (v) { setContraparteTipo(v as ContraparteTipo); setSucursalError(false); setProveedorError(false) } }}
              >
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proveedor">Proveedor</SelectItem>
                  <SelectItem value="sucursal">Sucursal</SelectItem>
                  <SelectItem value="persona">Persona</SelectItem>
                </SelectContent>
              </Select>
              {contraparteTipo === 'proveedor' && (
                <ProveedorSearch
                  value={selectedProveedor}
                  onChange={(p) => { setSelectedProveedor(p); if (p) setProveedorError(false) }}
                  error={proveedorError}
                  required
                />
              )}
              {contraparteTipo === 'sucursal' && (
                <Select
                  value={contraparteSucursalId}
                  onValueChange={(v) => { if (v) { setContraparteSucursalId(v); setSucursalError(false) } }}
                >
                  <SelectTrigger className={`flex-1 h-8 text-sm${sucursalError ? ' border-red-400 ring-1 ring-red-300' : ''}`}>
                    <SelectValue placeholder="Seleccioná sucursal…">
                      {sucursales.find(s => String(s.id) === contraparteSucursalId)?.nombre}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {contraparteTipo === 'persona' && (
                <Input
                  value={contraparteNombre}
                  onChange={e => setContraparteNombre(e.target.value)}
                  placeholder="Ej: Juan García, Dueño, Vendedor 1…"
                  className="flex-1 h-8 text-sm"
                />
              )}
            </div>
          </div>

          {/* Fila 3: Factura/Remito */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 w-28 shrink-0">Factura/Remito</span>
            <Input
              value={nroExterno}
              onChange={e => setNroExterno(e.target.value)}
              placeholder="Nro. externo (opcional)"
              className="w-52 h-8 text-sm"
            />
          </div>

        </div>

        {/* Ítems */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Ítems</h3>

          <div ref={searchRef} className="relative mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Buscar artículo por nombre o código…"
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

          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg">
              Buscá y seleccioná artículos para agregar
            </p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              {/* Cabecera */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[11px] font-medium text-gray-500 min-w-max">
                <span className="w-44 shrink-0">Artículo</span>
                <span className="w-16 shrink-0 text-center">Cant.</span>
                {tipo === 'entrada' && listasTodas.map(lista => (
                  <span key={lista.id} className={`w-24 shrink-0 text-center ${lista.categoria === 'costo' ? 'text-amber-600' : ''}`}>
                    {lista.nombre}
                    {lista.tipo === 'calculada' && lista.porcentaje != null && (
                      <span className="ml-1 font-normal text-gray-400">+{lista.porcentaje}%</span>
                    )}
                  </span>
                ))}
                <span className="w-6 shrink-0" />
              </div>

              {/* Filas */}
              <div className="divide-y divide-gray-100">
                {items.map(item => (
                  <div key={item._key} className="flex items-center gap-2 px-3 py-2 min-w-max">

                    {/* Artículo + variante */}
                    <div className="w-44 shrink-0 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{item.articulo_nombre}</p>
                      {item.articulo_codigo && (
                        <p className="text-[11px] text-gray-400 font-mono">{item.articulo_codigo}</p>
                      )}
                      {item.tipo_articulo === 'con_variantes' && item.variantes_list.length > 0 && (
                        <select
                          value={item.variante_id ?? ''}
                          onChange={e => handleVarianteChange(item._key, item.articulo_id, Number(e.target.value))}
                          className="mt-0.5 text-[11px] border border-gray-200 rounded px-1.5 py-0.5 w-full bg-white"
                        >
                          {item.variantes_list.map(v => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Cantidad */}
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.cantidad}
                      onChange={e => updateItem(item._key, { cantidad: parseInt(e.target.value, 10) || 1 })}
                      className="w-16 shrink-0 text-center border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    {/* Precios por lista (solo entrada) */}
                    {tipo === 'entrada' && (
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

                    {/* Eliminar */}
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

        {/* Indicador: precios de compra se actualizarán al confirmar */}
        {tipo === 'entrada' && contraparteTipo === 'proveedor' && items.some(i => Object.values(i.precios).some(v => v)) && (
          <div className="flex items-start gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
            <span className="mt-0.5">💡</span>
            <span>Al confirmar, los precios ingresados se registrarán en sus listas correspondientes para cada artículo.</span>
          </div>
        )}

        {/* Observaciones */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <Label className="mb-2 block">Observaciones (opcional)</Label>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Notas adicionales…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-6">
          <Button variant="outline" onClick={() => setShowExitDialog(true)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar como borrador'}
          </Button>
        </div>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader><DialogTitle>Remito guardado</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">¿Querés confirmar el remito ahora o dejarlo como borrador?</p>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={confirmingNew}
              onClick={() => router.push('/dashboard/inventario/remitos')}
            >
              Dejar como borrador
            </Button>
            <Button
              disabled={confirmingNew}
              onClick={async () => {
                if (!savedRemitoId) return
                setConfirmingNew(true)
                // Pasar precios extras en el body para registrarlos al confirmar
                const preciosExtras = savedItems
                  .map(i => ({
                    articulo_id: i.articulo_id,
                    variante_id: i.variante_id ?? null,
                    precios: Object.entries(i.precios)
                      .filter(([lid, v]) => v.trim() !== '' && Number(v) > 0 && Number(lid) !== compraLista?.id)
                      .map(([lid, precio]) => ({ lista_precio_id: Number(lid), precio: Number(precio) })),
                  }))
                  .filter(i => i.precios.length > 0)
                const r = await fetch(`/api/dashboard/stock/remitos/${savedRemitoId}/confirmar`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ precios_extras: preciosExtras }),
                })
                setConfirmingNew(false)
                if (r.ok) {
                  toast.success('Remito confirmado')
                } else {
                  const err = await r.json()
                  toast.error(err.error ?? 'Error al confirmar')
                }
                router.push('/dashboard/inventario/remitos')
              }}
            >
              {confirmingNew ? 'Confirmando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>¿Salir sin guardar?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Se perderán los datos ingresados. ¿Querés salir de todas formas?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>Quedarse</Button>
            <Button variant="destructive" onClick={() => router.push('/dashboard/inventario/remitos')}>Salir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
