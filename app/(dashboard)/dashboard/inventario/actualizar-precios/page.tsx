'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Search, TrendingUp, TrendingDown, ChevronRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface Marca { id: number; nombre: string }
interface Categoria { id: number; nombre: string; subcategorias: { id: number; nombre: string }[] }
interface ListaPrecio { id: number; nombre: string; tipo: string }
interface PreviewItem {
  articulo_id: number
  variante_id: number | null
  codigo: string
  nombre: string
  precio_actual: number | null
  key: string
}
interface Lote {
  id: string
  lista_nombre: string
  vigente_desde: string
  porcentaje: number
  signo: 'aumento' | 'descuento'
  items_count: number
  created_at: string
  estado: 'aplicado' | 'revertido'
  revertido_at: string | null
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

const fmtDt = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const fmtFecha = (s: string) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export default function ActualizarPreciosPage() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

  const [marcas, setMarcas] = useState<Marca[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [listas, setListas] = useState<ListaPrecio[]>([])

  // Filters
  const [codigo, setCodigo] = useState('')
  const [marcaId, setMarcaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [subcategoriaId, setSubcategoriaId] = useState('')

  // Update config
  const [listaId, setListaId] = useState('')
  const [signo, setSigno] = useState<'aumento' | 'descuento'>('aumento')
  const [porcentaje, setPorcentaje] = useState('')
  const [vigenteDesde, setVigenteDesde] = useState(today)

  // Results
  const [preview, setPreview] = useState<PreviewItem[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)

  // Historial
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loadingLotes, setLoadingLotes] = useState(true)
  const [reverting, setReverting] = useState<string | null>(null)

  const allCheckRef = useRef<HTMLInputElement>(null)

  const cargarLotes = useCallback(async () => {
    setLoadingLotes(true)
    const res = await fetch('/api/dashboard/precio-lotes')
    if (res.ok) setLotes(await res.json() as Lote[])
    setLoadingLotes(false)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/marcas').then(r => r.json()),
      fetch('/api/dashboard/categorias').then(r => r.json()),
      fetch('/api/dashboard/listas-precio').then(r => r.json()),
    ]).then(([m, c, l]) => {
      setMarcas((m as Marca[]) ?? [])
      setCategorias((c as Categoria[]) ?? [])
      setListas(((l as ListaPrecio[]) ?? []).filter(p => p.tipo === 'manual'))
    })
    cargarLotes()
  }, [cargarLotes])

  const subcategorias = useMemo(
    () => categorias.find(c => String(c.id) === categoriaId)?.subcategorias ?? [],
    [categorias, categoriaId]
  )

  const pct = Number(porcentaje)
  const factor = signo === 'aumento' ? (1 + pct / 100) : (1 - pct / 100)

  const previewWithCalc = useMemo(
    () => (preview ?? []).map(item => ({
      ...item,
      precio_nuevo: item.precio_actual != null && pct > 0
        ? Math.round(item.precio_actual * factor * 100) / 100
        : null,
    })),
    [preview, pct, factor]
  )

  const conPrecio = previewWithCalc.filter(i => i.precio_actual != null)
  const sinPrecio = previewWithCalc.filter(i => i.precio_actual == null)
  const allSelected = conPrecio.length > 0 && conPrecio.every(i => selected.has(i.key))
  const someSelected = conPrecio.some(i => selected.has(i.key))

  useEffect(() => {
    if (allCheckRef.current) {
      allCheckRef.current.indeterminate = someSelected && !allSelected
    }
  }, [someSelected, allSelected])

  async function handleBuscar() {
    if (!listaId) { toast.error('Seleccioná una lista de precio'); return }
    const params = new URLSearchParams({ lista_precio_id: listaId })
    if (marcaId) params.set('marca_id', marcaId)
    if (categoriaId) params.set('categoria_id', categoriaId)
    if (subcategoriaId) params.set('subcategoria_id', subcategoriaId)
    if (codigo.trim()) params.set('codigo', codigo.trim())

    setLoading(true)
    setPreview(null)
    setSelected(new Set())
    const res = await fetch(`/api/dashboard/articulos/actualizar-precios?${params}`)
    if (res.ok) {
      const data = (await res.json()) as Array<Omit<PreviewItem, 'key'>>
      const items: PreviewItem[] = data.map(item => ({
        ...item,
        key: `${item.articulo_id}_${item.variante_id ?? 'null'}`,
      }))
      setPreview(items)
      setSelected(new Set(items.filter(i => i.precio_actual != null).map(i => i.key)))
    } else {
      const e = await res.json() as { error?: string }
      toast.error(e.error ?? 'Error al buscar')
    }
    setLoading(false)
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(conPrecio.map(i => i.key)) : new Set())
  }

  function toggleItem(key: string, hasPrecio: boolean) {
    if (!hasPrecio) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleAplicar() {
    if (!pct || pct <= 0) { toast.error('Ingresá un porcentaje mayor a 0'); return }
    if (selected.size === 0) { toast.error('No hay artículos seleccionados'); return }

    const items = previewWithCalc
      .filter(i => selected.has(i.key) && i.precio_actual != null)
      .map(i => ({
        articulo_id: i.articulo_id,
        variante_id: i.variante_id,
        precio_nuevo: Math.round(i.precio_actual! * factor * 100) / 100,
      }))

    setApplying(true)
    const res = await fetch('/api/dashboard/articulos/actualizar-precios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lista_precio_id: Number(listaId),
        vigente_desde: vigenteDesde,
        porcentaje: pct,
        signo,
        items,
      }),
    })
    if (res.ok) {
      const { updated } = await res.json() as { updated: number }
      toast.success(`${updated} precio${updated !== 1 ? 's' : ''} actualizados`)
      setPreview(null)
      setSelected(new Set())
      await cargarLotes()
    } else {
      const e = await res.json() as { error?: string }
      toast.error(e.error ?? 'Error al aplicar')
    }
    setApplying(false)
  }

  async function handleRevertir(loteId: string) {
    if (!confirm('¿Revertir esta actualización? Se eliminarán los precios ingresados en ese lote y quedarán vigentes los anteriores.')) return
    setReverting(loteId)
    const res = await fetch(`/api/dashboard/precio-lotes/${loteId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Actualización revertida')
      await cargarLotes()
    } else {
      const e = await res.json() as { error?: string }
      toast.error(e.error ?? 'Error al revertir')
    }
    setReverting(null)
  }

  function limpiarFiltros() {
    setCodigo(''); setMarcaId(''); setCategoriaId(''); setSubcategoriaId('')
    setPreview(null); setSelected(new Set())
  }

  return (
    <div className="max-w-4xl space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Actualización masiva de precios</h2>

      {/* Form panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">

        {/* Filtros */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Filtros</p>
            {(codigo || marcaId || categoriaId || subcategoriaId) && (
              <button className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2" onClick={limpiarFiltros}>
                Limpiar
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Código</Label>
              <Input placeholder="Ej: ART001" value={codigo} onChange={e => setCodigo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleBuscar()} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Marca</Label>
              <Select value={marcaId || '_all'} onValueChange={v => v !== null && setMarcaId(v === '_all' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{marcaId ? (marcas.find(m => String(m.id) === marcaId)?.nombre ?? '—') : 'Todas'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todas</SelectItem>
                  {marcas.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rubro</Label>
              <Select
                value={categoriaId || '_all'}
                onValueChange={v => { if (v === null) return; const val = v === '_all' ? '' : v; setCategoriaId(val); setSubcategoriaId('') }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{categoriaId ? (categorias.find(c => String(c.id) === categoriaId)?.nombre ?? '—') : 'Todos'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos</SelectItem>
                  {categorias.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subrubro</Label>
              <Select value={subcategoriaId || '_all'} onValueChange={v => v !== null && setSubcategoriaId(v === '_all' ? '' : v)} disabled={!categoriaId}>
                <SelectTrigger className="w-full">
                  <SelectValue>{subcategoriaId ? (subcategorias.find(s => String(s.id) === subcategoriaId)?.nombre ?? '—') : 'Todos'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos</SelectItem>
                  {subcategorias.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100" />

        {/* Actualización */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Actualización</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Lista de precio</Label>
              <Select value={listaId || '_none'} onValueChange={v => v !== null && setListaId(v === '_none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{listaId ? (listas.find(l => String(l.id) === listaId)?.nombre ?? '—') : 'Seleccionar…'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {listas.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de ajuste</Label>
              <Select value={signo} onValueChange={v => v !== null && setSigno(v as 'aumento' | 'descuento')}>
                <SelectTrigger className="w-full">
                  <SelectValue>{signo === 'aumento' ? 'Aumento' : 'Descuento'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aumento">Aumento</SelectItem>
                  <SelectItem value="descuento">Descuento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Porcentaje (%)</Label>
              <Input type="number" min="0" max="999" step="0.01" placeholder="0.00" value={porcentaje} onChange={e => setPorcentaje(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vigente desde</Label>
              <Input type="date" value={vigenteDesde} onChange={e => setVigenteDesde(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={handleBuscar} disabled={loading || !listaId}>
            <Search className="w-4 h-4 mr-1.5" />
            {loading ? 'Buscando…' : 'Buscar artículos'}
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {preview !== null && previewWithCalc.length === 0 && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No se encontraron artículos con los filtros seleccionados.</p>
        </div>
      )}

      {/* Preview table */}
      {previewWithCalc.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">
                <span className="font-semibold text-gray-900">{previewWithCalc.length}</span> artículos
              </span>
              {conPrecio.length > 0 && <span className="text-gray-600">{conPrecio.length} con precio</span>}
              {sinPrecio.length > 0 && <span className="text-gray-400 text-xs">{sinPrecio.length} sin precio (se omitirán)</span>}
            </div>
            {pct > 0 && (
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                {signo === 'aumento' ? <TrendingUp className="w-4 h-4 text-green-600" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                <span className={signo === 'aumento' ? 'text-green-600' : 'text-red-500'}>
                  {signo === 'aumento' ? '+' : '-'}{porcentaje}%
                </span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-10 pl-5">
                    <input ref={allCheckRef} type="checkbox" checked={allSelected} onChange={e => toggleAll(e.target.checked)} className="w-4 h-4 cursor-pointer" disabled={conPrecio.length === 0} />
                  </TableHead>
                  <TableHead className="w-32">Código</TableHead>
                  <TableHead>Artículo</TableHead>
                  <TableHead className="text-right w-32">Precio actual</TableHead>
                  <TableHead className="w-6"></TableHead>
                  <TableHead className="text-right w-36">Precio nuevo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewWithCalc.map(item => {
                  const hasPrecio = item.precio_actual != null
                  const isChecked = selected.has(item.key)
                  const precioNuevo = hasPrecio && pct > 0 && isChecked
                    ? Math.round(item.precio_actual! * factor * 100) / 100
                    : null
                  return (
                    <TableRow key={item.key} className={`cursor-pointer transition-colors ${!hasPrecio ? 'opacity-35' : isChecked ? '' : 'opacity-50'}`} onClick={() => toggleItem(item.key, hasPrecio)}>
                      <TableCell className="pl-5">
                        <input type="checkbox" checked={isChecked} onChange={() => toggleItem(item.key, hasPrecio)} disabled={!hasPrecio} className="w-4 h-4 cursor-pointer" onClick={e => e.stopPropagation()} />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">{item.codigo || '—'}</TableCell>
                      <TableCell className="text-sm text-gray-800">{item.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-gray-700">
                        {hasPrecio ? fmt(item.precio_actual!) : <span className="text-gray-300 text-xs">Sin precio</span>}
                      </TableCell>
                      <TableCell>
                        {hasPrecio && pct > 0 && isChecked && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-semibold pr-5">
                        {precioNuevo != null
                          ? <span className={signo === 'aumento' ? 'text-green-700' : 'text-red-600'}>{fmt(precioNuevo)}</span>
                          : <span className="text-gray-300">—</span>}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => { setPreview(null); setSelected(new Set()) }}>
              Cancelar
            </Button>
            <Button onClick={handleAplicar} disabled={applying || selected.size === 0 || !pct || pct <= 0}>
              {applying ? 'Aplicando…' : `Aplicar actualización (${selected.size} artículo${selected.size !== 1 ? 's' : ''})`}
            </Button>
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Historial de actualizaciones</p>
        </div>

        {loadingLotes && <p className="px-5 py-4 text-sm text-gray-400">Cargando…</p>}

        {!loadingLotes && lotes.length === 0 && (
          <p className="px-5 py-4 text-sm text-gray-400">Sin actualizaciones registradas.</p>
        )}

        {!loadingLotes && lotes.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Lista</TableHead>
                  <TableHead>Ajuste</TableHead>
                  <TableHead className="text-center">Artículos</TableHead>
                  <TableHead>Vigente desde</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.map(lote => (
                  <TableRow key={lote.id} className={lote.estado === 'revertido' ? 'opacity-50' : ''}>
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">{fmtDt(lote.created_at)}</TableCell>
                    <TableCell className="text-sm font-medium">{lote.lista_nombre}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        {lote.signo === 'aumento'
                          ? <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                          : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                        <span className={lote.signo === 'aumento' ? 'text-green-700' : 'text-red-600'}>
                          {lote.signo === 'aumento' ? '+' : '-'}{lote.porcentaje}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm text-gray-600">{lote.items_count}</TableCell>
                    <TableCell className="text-sm text-gray-600">{fmtFecha(lote.vigente_desde)}</TableCell>
                    <TableCell>
                      <Badge variant={lote.estado === 'aplicado' ? 'default' : 'secondary'} className="text-xs">
                        {lote.estado === 'aplicado' ? 'Aplicado' : 'Revertido'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lote.estado === 'aplicado' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={reverting === lote.id}
                          onClick={() => handleRevertir(lote.id)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          {reverting === lote.id ? 'Revirtiendo…' : 'Revertir'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
