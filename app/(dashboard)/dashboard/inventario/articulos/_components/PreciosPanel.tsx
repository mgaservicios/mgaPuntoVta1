'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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

// Evita el problema de UTC midnight: 'YYYY-MM-DD' se parsea como día anterior en zonas UTC-N
const fmtFecha = (s: string) => {
  if (!s) return '—'
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Fecha de hoy en zona Buenos Aires (YYYY-MM-DD), independiente del timezone del navegador
function localDateStr(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date())
}

/**
 * Convierte una fecha YYYY-MM-DD a timestamp con zona horaria Buenos Aires (-03:00).
 * Si la fecha es hoy → usa la hora actual. Si es otro día → usa 00:00:00.
 */
function vigenteDesdeBsAs(dateStr: string): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = localDateStr()
  if (dateStr === today) {
    const ahora = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date()).replace(' ', 'T')
    return ahora + '-03:00'
  }
  return `${dateStr}T00:00:00-03:00`
}


interface Props {
  articuloId: number
  varianteId?: number | null
  /** Si el artículo tiene variantes, se muestra una nota aclaratoria */
  tieneVariantes?: boolean
}

interface PrecioForm {
  lista_precio_id: string
  precio: string
  origen_tipo: 'manual' | 'proveedor' | 'sucursal'
  origen_proveedor_id: string
  vigente_desde: string
}

const FORM_EMPTY: PrecioForm = {
  lista_precio_id: '',
  precio: '',
  origen_tipo: 'manual',
  origen_proveedor_id: '',
  vigente_desde: '',
}

export default function PreciosPanel({ articuloId, varianteId, tieneVariantes }: Props) {
  const [costoVigentes, setCostoVigentes] = useState<PrecioVigente[]>([])
  const [ventaVigentes, setVentaVigentes] = useState<PrecioVigente[]>([])
  const [historial, setHistorial] = useState<Precio[]>([])
  const [listasManual, setListasManual] = useState<ListaPrecio[]>([])
  const [listasTodas, setListasTodas] = useState<ListaPrecio[]>([])
  const [proveedores, setProveedores] = useState<{ id: number; nombre: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [showHistorial, setShowHistorial] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PrecioForm>(FORM_EMPTY)
  const [formCategoria, setFormCategoria] = useState<'costo' | 'venta' | null>(null)
  const [preciosDerivados, setPreciosDerivados] = useState<Record<number, string>>({})
  const [guardando, setGuardando] = useState(false)

  const [histFechaDesde, setHistFechaDesde] = useState(localDateStr)
  const [histFechaHasta, setHistFechaHasta] = useState(localDateStr)

  const varianteParam = varianteId ? `&variante_id=${varianteId}` : ''

  const cargarDatos = useCallback(async () => {
    const [preciosRes, listasRes, provRes] = await Promise.all([
      fetch(`/api/dashboard/articulos/${articuloId}/precios?${varianteParam}`),
      fetch('/api/dashboard/listas-precio'),
      fetch('/api/dashboard/proveedores'),
    ])
    const [preciosData, listasData, provData] = await Promise.all([
      preciosRes.json() as Promise<ArticuloPreciosResponse>,
      listasRes.json() as Promise<ListaPrecio[]>,
      provRes.json(),
    ])

    const costoListas = (listasData ?? []).filter((l) => l.categoria === 'costo' && l.activo)
    const costoIds = new Set(costoListas.map((l) => l.id))
    setCostoVigentes((preciosData.vigentes ?? []).filter((pv) => costoIds.has(pv.lista_precio_id)))

    const ventaListas = (listasData ?? []).filter((l) => l.categoria === 'venta' && l.activo)
    const ventaIds = new Set(ventaListas.map((l) => l.id))
    setVentaVigentes((preciosData.vigentes ?? []).filter((pv) => ventaIds.has(pv.lista_precio_id)))
    setHistorial(preciosData.historial ?? [])
    setListasManual((listasData ?? []).filter((l) => l.tipo === 'manual' && l.activo))
    setListasTodas((listasData ?? []).filter((l) => l.activo))
    setProveedores(Array.isArray(provData) ? provData : [])
    setLoading(false)
  }, [articuloId, varianteParam])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // Listas calculadas que derivan de la lista seleccionada en el form
  const derivadosInfo = useMemo(() => {
    if (!form.lista_precio_id) return []
    const listaId = Number(form.lista_precio_id)
    return listasTodas.filter(l => l.tipo === 'calculada' && l.lista_base_id === listaId)
  }, [form.lista_precio_id, listasTodas])

  // Auto-computar precios derivados cuando cambia la lista base o el precio
  useEffect(() => {
    if (derivadosInfo.length === 0) { setPreciosDerivados({}); return }
    const numPrecio = Number(form.precio)
    const result: Record<number, string> = {}
    for (const l of derivadosInfo) {
      result[l.id] = numPrecio > 0 ? (numPrecio * (1 + Number(l.porcentaje) / 100)).toFixed(2) : ''
    }
    setPreciosDerivados(result)
  }, [form.lista_precio_id, form.precio, derivadosInfo])

  function openNuevo(listaPrecioId?: number, categoria?: 'costo' | 'venta') {
    const defaultId = listaPrecioId
      ? String(listaPrecioId)
      : categoria
        ? String(listasManual.find(l => l.categoria === categoria)?.id ?? '')
        : String(listasManual[0]?.id ?? '')
    setFormCategoria(categoria ?? null)
    setForm({
      ...FORM_EMPTY,
      lista_precio_id: defaultId,
      vigente_desde: localDateStr(),
    })
    setPreciosDerivados({})
    setShowForm(true)
  }

  function cerrarForm() {
    setShowForm(false)
    setForm(FORM_EMPTY)
    setFormCategoria(null)
    setPreciosDerivados({})
  }

  async function handleGuardar() {
    if (!form.lista_precio_id || !form.precio) {
      toast.error('Completá la lista y el precio')
      return
    }
    setGuardando(true)

    const vigenteDesde = vigenteDesdeBsAs(form.vigente_desde || localDateStr())

    const baseBody = {
      variante_id: varianteId ?? null,
      lista_precio_id: Number(form.lista_precio_id),
      precio: Number(form.precio),
      origen_tipo: form.origen_tipo,
      origen_proveedor_id:
        form.origen_tipo === 'proveedor' && form.origen_proveedor_id
          ? Number(form.origen_proveedor_id)
          : null,
      vigente_desde: vigenteDesde,
    }

    const res = await fetch(`/api/dashboard/articulos/${articuloId}/precios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
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
              variante_id: varianteId ?? null,
              lista_precio_id: Number(listaId),
              precio: Number(precio),
              origen_tipo: form.origen_tipo,
              vigente_desde: vigenteDesde,
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

  if (loading) return null

  return (
    <>
      {/* ── Precios de costo vigentes ── */}
      {costoVigentes.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Precios de costo
              </h3>
            </div>
            <Button size="sm" variant="outline" onClick={() => openNuevo(undefined, 'costo')}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Nuevo precio
            </Button>
          </div>
          <div className="divide-y divide-gray-100">
            {costoVigentes.map((pv) => {
              const precio = pv.precio_calculado ?? pv.precio
              const tieneValor = precio > 0
              return (
                <div key={pv.lista_precio_id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">{pv.lista_precio?.nombre}</span>
                    {pv.lista_precio?.tipo === 'calculada' && (
                      <Badge variant="secondary" className="text-[10px]">Calculado</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-lg font-bold tabular-nums ${tieneValor ? 'text-gray-900' : 'text-gray-300'}`}>
                        {tieneValor ? fmt(precio) : 'Sin precio'}
                      </p>
                      {pv.vigente_desde && (
                        <p className="text-xs text-gray-400">desde {fmtFecha(pv.vigente_desde)}</p>
                      )}
                    </div>
                    {pv.lista_precio?.tipo === 'manual' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-400 hover:text-gray-700"
                        title="Modificar precio"
                        onClick={() => openNuevo(pv.lista_precio_id, 'costo')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Precios de venta vigentes ── */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Precios de venta
            </h3>
            {tieneVariantes && (
              <p className="text-xs text-gray-400 mt-0.5">
                Precio base — aplica a variantes que no tengan precio diferencial
              </p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => openNuevo(undefined, 'venta')}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nuevo precio
          </Button>
        </div>

        {ventaVigentes.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Sin precios de venta registrados.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {ventaVigentes.map((pv) => {
              const precio = pv.precio_calculado ?? pv.precio
              const tieneValor = precio > 0
              return (
                <div key={pv.lista_precio_id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">{pv.lista_precio?.nombre}</span>
                    {pv.lista_precio?.tipo === 'calculada' && (
                      <Badge variant="secondary" className="text-[10px]">Calculado</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-lg font-bold tabular-nums ${tieneValor ? 'text-gray-900' : 'text-gray-300'}`}>
                        {tieneValor ? fmt(precio) : 'Sin precio'}
                      </p>
                      {pv.vigente_desde && (
                        <p className="text-xs text-gray-400">desde {fmtFecha(pv.vigente_desde)}</p>
                      )}
                    </div>
                    {pv.lista_precio?.tipo === 'manual' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-400 hover:text-gray-700"
                        title="Modificar precio"
                        onClick={() => openNuevo(pv.lista_precio_id, 'venta')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="pt-1">
          <Button
            size="sm"
            variant="ghost"
            className="text-gray-500 hover:text-gray-700 px-0"
            onClick={() => {
              const hoy = localDateStr()
              setHistFechaDesde(hoy)
              setHistFechaHasta(hoy)
              setShowHistorial(true)
            }}
          >
            <History className="w-3.5 h-3.5 mr-1.5" />
            Historial de precios
          </Button>
        </div>
      </section>

      {/* ── Dialog: Nuevo / Modificar precio ── */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) cerrarForm() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {form.lista_precio_id ? 'Modificar precio' : 'Nuevo precio'}
              {formCategoria && (
                <span className="ml-1 text-gray-400 font-normal text-sm">
                  — {formCategoria === 'costo' ? 'Compra' : 'Venta'}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Lista de precio</Label>
              <Select
                value={form.lista_precio_id}
                onValueChange={(v) => setForm((f) => ({ ...f, lista_precio_id: v ?? '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar lista…">
                    {listasManual.find(l => String(l.id) === form.lista_precio_id)?.nombre}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {listasManual
                    .filter(l => !formCategoria || l.categoria === formCategoria)
                    .map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.nombre}
                        {!formCategoria && (
                          <span className="ml-2 text-xs text-gray-400">
                            ({l.categoria === 'costo' ? 'Costo' : 'Venta'})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Precio</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.precio}
                onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                autoFocus
              />
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
              <Input
                type="date"
                value={form.vigente_desde}
                onChange={(e) => setForm((f) => ({ ...f, vigente_desde: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Origen</Label>
              <Select
                value={form.origen_tipo}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, origen_tipo: v as PrecioForm['origen_tipo'], origen_proveedor_id: '' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="proveedor">Proveedor</SelectItem>
                  <SelectItem value="sucursal">Sucursal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.origen_tipo === 'proveedor' && (
              <div className="space-y-1">
                <Label className="text-xs">Proveedor</Label>
                <Select
                  value={form.origen_proveedor_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, origen_proveedor_id: v ?? '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {proveedores.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cerrarForm}>
              Cancelar
            </Button>
            <Button onClick={handleGuardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Historial de precios ── */}
      <Dialog open={showHistorial} onOpenChange={setShowHistorial}>
        <DialogContent className="sm:max-w-[615px]">
          <DialogHeader>
            <DialogTitle>Historial de precios</DialogTitle>
          </DialogHeader>

          {/* Filtros de fecha */}
          <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 flex-1 min-w-[140px]">
              <Label className="text-xs font-medium text-gray-600 whitespace-nowrap">Desde</Label>
              <Input
                type="date"
                className="h-8 text-sm"
                value={histFechaDesde}
                onChange={(e) => setHistFechaDesde(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[140px]">
              <Label className="text-xs font-medium text-gray-600 whitespace-nowrap">Hasta</Label>
              <Input
                type="date"
                className="h-8 text-sm"
                value={histFechaHasta}
                onChange={(e) => setHistFechaHasta(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs shrink-0"
              onClick={() => { setHistFechaDesde(''); setHistFechaHasta('') }}
            >
              Ver todo
            </Button>
          </div>

          {(() => {
            const filtrado = historial.filter((p) => {
              const fecha = p.vigente_desde?.slice(0, 10) ?? ''
              if (histFechaDesde && fecha < histFechaDesde) return false
              if (histFechaHasta && fecha > histFechaHasta) return false
              return true
            })
            return filtrado.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Sin registros para el período seleccionado.</p>
            ) : (
              <div className="overflow-y-auto max-h-[50vh] rounded-lg border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs font-semibold text-gray-600">Lista</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600 text-right">Precio</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600">Vigente desde</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600">Origen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrado.map((p) => (
                      <TableRow key={p.id} className="hover:bg-gray-50">
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{p.lista_precio?.nombre}</span>
                            {p.lista_precio?.tipo === 'calculada' && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">calc.</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5 text-right tabular-nums font-semibold text-gray-900">
                          {fmt(p.precio)}
                        </TableCell>
                        <TableCell className="py-2.5 text-sm text-gray-500">{fmtFecha(p.vigente_desde)}</TableCell>
                        <TableCell className="py-2.5 text-sm text-gray-500">
                          {p.origen_tipo === 'remito'
                            ? 'Remito'
                            : p.origen_tipo === 'proveedor'
                              ? (p.proveedor?.nombre ?? 'Proveedor')
                              : p.origen_tipo === 'sucursal'
                                ? (p.sucursal?.nombre ?? 'Sucursal')
                                : 'Manual'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistorial(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
