'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { History, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { ListaPrecio, PrecioVigente, Precio, ArticuloPreciosResponse } from '@/types/precios'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

const fmtFecha = (s: string) =>
  s ? new Date(s).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

interface PrecioForm {
  lista_precio_id: string
  precio: string
  origen_tipo: 'manual' | 'proveedor' | 'sucursal'
  vigente_desde: string
}

const FORM_EMPTY: PrecioForm = { lista_precio_id: '', precio: '', origen_tipo: 'manual', vigente_desde: '' }

interface Props {
  open: boolean
  onClose: () => void
  articuloId: number
  varianteId: number
  varianteLabel: string
}

export default function VariantePreciosDialog({ open, onClose, articuloId, varianteId, varianteLabel }: Props) {
  const [ventaVigentes, setVentaVigentes] = useState<PrecioVigente[]>([])
  const [historial, setHistorial] = useState<Precio[]>([])
  const [listasManual, setListasManual] = useState<ListaPrecio[]>([])
  const [listasTodas, setListasTodas] = useState<ListaPrecio[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistorial, setShowHistorial] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PrecioForm>(FORM_EMPTY)
  const [preciosDerivados, setPreciosDerivados] = useState<Record<number, string>>({})
  const [guardando, setGuardando] = useState(false)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    const [preciosRes, listasRes] = await Promise.all([
      fetch(`/api/dashboard/articulos/${articuloId}/precios?variante_id=${varianteId}`),
      fetch('/api/dashboard/listas-precio'),
    ])
    const [preciosData, listasData] = await Promise.all([
      preciosRes.json() as Promise<ArticuloPreciosResponse>,
      listasRes.json() as Promise<ListaPrecio[]>,
    ])
    const ventaIds = new Set(
      (listasData ?? []).filter((l) => l.categoria === 'venta' && l.activo).map((l) => l.id)
    )
    setVentaVigentes((preciosData.vigentes ?? []).filter((pv) => ventaIds.has(pv.lista_precio_id)))
    setHistorial(preciosData.historial ?? [])
    setListasManual((listasData ?? []).filter((l) => l.tipo === 'manual' && l.activo))
    setListasTodas((listasData ?? []).filter((l) => l.activo))
    setLoading(false)
  }, [articuloId, varianteId])

  useEffect(() => { if (open) cargarDatos() }, [open, cargarDatos])

  const derivadosInfo = useMemo(() => {
    if (!form.lista_precio_id) return []
    const listaId = Number(form.lista_precio_id)
    return listasTodas.filter(l => l.tipo === 'calculada' && l.lista_base_id === listaId)
  }, [form.lista_precio_id, listasTodas])

  useEffect(() => {
    if (derivadosInfo.length === 0) { setPreciosDerivados({}); return }
    const numPrecio = Number(form.precio)
    const result: Record<number, string> = {}
    for (const l of derivadosInfo) {
      result[l.id] = numPrecio > 0 ? (numPrecio * (1 + Number(l.porcentaje) / 100)).toFixed(2) : ''
    }
    setPreciosDerivados(result)
  }, [form.lista_precio_id, form.precio, derivadosInfo])

  function openNuevo(listaPrecioId?: number) {
    setForm({
      ...FORM_EMPTY,
      lista_precio_id: listaPrecioId ? String(listaPrecioId) : '1',
      vigente_desde: new Date().toISOString().slice(0, 10),
    })
    setPreciosDerivados({})
    setShowForm(true)
  }

  function cerrarForm() {
    setShowForm(false)
    setForm(FORM_EMPTY)
    setPreciosDerivados({})
  }

  async function handleGuardar() {
    if (!form.lista_precio_id || !form.precio) { toast.error('Completá la lista y el precio'); return }
    setGuardando(true)
    const res = await fetch(`/api/dashboard/articulos/${articuloId}/precios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variante_id: varianteId,
        lista_precio_id: Number(form.lista_precio_id),
        precio: Number(form.precio),
        origen_tipo: form.origen_tipo,
        vigente_desde: form.vigente_desde || undefined,
      }),
    })
    if (res.ok) {
      // Guardar precios derivados con valor > 0
      const derivadosTasks = Object.entries(preciosDerivados)
        .filter(([, v]) => v.trim() !== '' && Number(v) > 0)
        .map(([listaId, precio]) =>
          fetch(`/api/dashboard/articulos/${articuloId}/precios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              variante_id: varianteId,
              lista_precio_id: Number(listaId),
              precio: Number(precio),
              origen_tipo: form.origen_tipo,
              vigente_desde: form.vigente_desde || undefined,
            }),
          })
        )
      await Promise.all(derivadosTasks)
      toast.success('Precio actualizado')
      cerrarForm()
      await cargarDatos()
    } else {
      const e = await res.json()
      toast.error(e.error ?? 'Error al guardar')
    }
    setGuardando(false)
  }

  return (
    <>
      <Dialog open={open && !showHistorial && !showForm} onOpenChange={(o) => { if (!o) onClose() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              Precios — <span className="font-normal text-gray-600">{varianteLabel}</span>
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Cargando…</p>
          ) : (
            <div className="space-y-1 py-1">
              {ventaVigentes.length === 0 ? (
                <p className="text-sm text-gray-400 py-3 text-center">Sin precios de venta registrados.</p>
              ) : (
                ventaVigentes.map((pv) => {
                  const precio = pv.precio_calculado ?? pv.precio
                  const tieneValor = precio > 0
                  return (
                    <div key={pv.lista_precio_id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-gray-700 truncate">{pv.lista_precio?.nombre}</span>
                        {pv.heredado && (
                          <Badge variant="outline" className="text-[10px] shrink-0 text-gray-400">Heredado</Badge>
                        )}
                        {pv.lista_precio?.tipo === 'calculada' && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">Calculado</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className={`text-base font-bold tabular-nums ${tieneValor ? 'text-gray-900' : 'text-gray-300'}`}>
                            {tieneValor ? fmt(precio) : 'Sin precio'}
                          </p>
                          {pv.vigente_desde && (
                            <p className="text-[10px] text-gray-400">desde {fmtFecha(pv.vigente_desde)}</p>
                          )}
                        </div>
                        {pv.lista_precio?.tipo === 'manual' && (
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-gray-700"
                            title={pv.heredado ? 'Cargar precio diferencial' : 'Modificar precio'}
                            onClick={() => openNuevo(pv.lista_precio_id)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          <DialogFooter className="flex-row items-center justify-between pt-2">
            <Button size="sm" variant="ghost" className="text-gray-500 px-0" onClick={() => setShowHistorial(true)}>
              <History className="w-3.5 h-3.5 mr-1.5" />
              Historial
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openNuevo()}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nuevo precio
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>Cerrar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Formulario nuevo/modificar precio */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) cerrarForm() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{form.lista_precio_id ? 'Modificar precio' : 'Nuevo precio'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Lista de precio</Label>
              <Select value={form.lista_precio_id} onValueChange={(v) => setForm((f) => ({ ...f, lista_precio_id: v ?? '' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar lista…">
                    {listasManual.find(l => String(l.id) === form.lista_precio_id)?.nombre}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {listasManual.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.nombre}
                      <span className="ml-2 text-xs text-gray-400">({l.categoria === 'costo' ? 'Costo' : 'Venta'})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" autoFocus
                value={form.precio} onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))} />
            </div>

            {/* Precios derivados de listas calculadas */}
            {derivadosInfo.length > 0 && form.precio && (
              <div className="space-y-2 pt-1 border-t border-gray-100">
                <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">
                  Precios de venta derivados
                </p>
                {derivadosInfo.map((l) => (
                  <div key={l.id} className="space-y-1">
                    <Label className="text-xs flex items-center gap-1.5">
                      {l.nombre}
                      <span className="text-gray-400 font-normal">+{l.porcentaje}%</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={preciosDerivados[l.id] ?? ''}
                      onChange={(e) => setPreciosDerivados((prev) => ({ ...prev, [l.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Vigente desde (opcional)</Label>
              <Input type="date" value={form.vigente_desde}
                onChange={(e) => setForm((f) => ({ ...f, vigente_desde: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cerrarForm}>Cancelar</Button>
            <Button onClick={handleGuardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Historial de la variante */}
      <Dialog open={showHistorial} onOpenChange={setShowHistorial}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial de precios — {varianteLabel}</DialogTitle>
          </DialogHeader>
          {historial.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Sin historial registrado para esta variante.</p>
          ) : (
            <div className="overflow-y-auto max-h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lista</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead>Vigente desde</TableHead>
                    <TableHead>Origen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historial.map((p) => (
                    <TableRow key={p.id} className="text-sm">
                      <TableCell className="font-medium">{p.lista_precio?.nombre}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmt(p.precio)}</TableCell>
                      <TableCell className="text-gray-500">{fmtFecha(p.vigente_desde)}</TableCell>
                      <TableCell className="text-gray-500">
                        {p.origen_tipo === 'remito' ? 'Remito'
                          : p.origen_tipo === 'proveedor' ? (p.proveedor?.nombre ?? 'Proveedor')
                          : p.origen_tipo === 'sucursal' ? (p.sucursal?.nombre ?? 'Sucursal')
                          : 'Manual'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistorial(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
