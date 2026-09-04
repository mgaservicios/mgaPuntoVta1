'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Eye, Pencil, Check, Trash2, Printer, Ban } from 'lucide-react'
import { useSelectedSucursal } from '@/hooks/useSelectedSucursal'
import { usePermissions } from '@/components/PermissionsProvider'
import { buttonVariants, Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { Remito } from '@/types/stock'

type RemitoRow = Remito & { contraparte_display: string; nombre_sucursal?: string | null; total: number }

const TIPO_LABELS: Record<string, string> = { entrada: 'Entrada', salida: 'Salida' }
const ESTADO_LABELS: Record<string, string> = { borrador: 'Borrador', confirmado: 'Confirmado', anulado: 'Anulado' }
const CONTRAPARTE_LABELS: Record<string, string> = { sucursal: 'Sucursal', proveedor: 'Proveedor', persona: 'Persona' }

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

export default function RemitosClient({ isAdmin }: { isAdmin: boolean }) {
  const { isHome } = useSelectedSucursal()
  const canWrite = isHome !== false
  const { can } = usePermissions()
  const [remitos, setRemitos] = useState<RemitoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tipo, setTipo] = useState('todos')
  const [estado, setEstado] = useState('todos')
  const [contraparteTipo, setContraparteTipo] = useState('todos')
  const [buscar, setBuscar] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null)

  // Eliminar remito
  const [deletingRemito, setDeletingRemito] = useState<RemitoRow | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Anular remito
  const [anulandoRemito, setAnulandoRemito] = useState<RemitoRow | null>(null)
  const [confirmingAnular, setConfirmingAnular] = useState(false)

  const fetchRemitos = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (tipo !== 'todos') params.set('tipo', tipo)
    if (estado !== 'todos') params.set('estado', estado)
    if (contraparteTipo !== 'todos') params.set('contraparte_tipo', contraparteTipo)
    if (buscar.trim()) params.set('buscar', buscar.trim())
    if (fechaDesde) params.set('fecha_desde', fechaDesde)
    if (fechaHasta) params.set('fecha_hasta', fechaHasta)
    const res = await fetch(`/api/dashboard/stock/remitos?${params}`)
    const data = await res.json()
    setRemitos(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [tipo, estado, contraparteTipo, buscar, fechaDesde, fechaHasta])

  useEffect(() => { fetchRemitos() }, [fetchRemitos])

  const showSucursal = remitos.some(r => r.nombre_sucursal)

  async function handleConfirmar(id: number) {
    setConfirmandoId(id)
    const res = await fetch(`/api/dashboard/stock/remitos/${id}/confirmar`, { method: 'POST' })
    setConfirmandoId(null)
    if (res.ok) {
      toast.success('Remito confirmado')
      setRemitos(prev => prev.map(r => r.id === id ? { ...r, estado: 'confirmado' } : r))
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al confirmar')
    }
  }

  async function handleEliminar() {
    if (!deletingRemito) return
    setConfirmingDelete(true)
    const res = await fetch(`/api/dashboard/stock/remitos/${deletingRemito.id}`, { method: 'DELETE' })
    setConfirmingDelete(false)
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error al eliminar'); setDeletingRemito(null); return }
    toast.success(`Remito ${deletingRemito.numero} eliminado`)
    setDeletingRemito(null)
    fetchRemitos()
  }

  async function handleAnular() {
    if (!anulandoRemito) return
    setConfirmingAnular(true)
    const res = await fetch(`/api/dashboard/stock/remitos/${anulandoRemito.id}/anular`, { method: 'POST' })
    setConfirmingAnular(false)
    if (!res.ok) { const d = await res.json(); toast.error(d.error ?? 'Error al anular'); setAnulandoRemito(null); return }
    toast.success(`Remito ${anulandoRemito.numero} anulado`)
    setAnulandoRemito(null)
    fetchRemitos()
  }

  function formatFecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const grandTotal = remitos.reduce((acc, r) => acc + (r.total || 0), 0)

  async function handlePrintList() {
    let sucursalNombre = ''
    let sucursalLogo: string | null = null
    try {
      const res = await fetch('/api/dashboard/sucursales/selected')
      const data = await res.json()
      sucursalNombre = data?.nombre ?? ''
      sucursalLogo = data?.logo_url ?? null
    } catch {}

    const filtros: string[] = []
    if (tipo !== 'todos') filtros.push(`Tipo: ${TIPO_LABELS[tipo]}`)
    if (estado !== 'todos') filtros.push(`Estado: ${ESTADO_LABELS[estado]}`)
    if (contraparteTipo !== 'todos') filtros.push(`Origen/Destino: ${CONTRAPARTE_LABELS[contraparteTipo]}`)
    if (buscar.trim()) filtros.push(`Buscar: ${buscar.trim()}`)
    if (fechaDesde || fechaHasta) {
      const d = fechaDesde || '…'
      const h = fechaHasta || '…'
      filtros.push(`Período: ${d} al ${h}`)
    }

    const logoSrc = sucursalLogo || '/logos/logo blanco.png'
    const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const rows = remitos.map(r => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${r.numero}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">${formatFecha(r.fecha)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">${TIPO_LABELS[r.tipo]}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">${r.contraparte_display}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">${ESTADO_LABELS[r.estado]}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right">${r.total > 0 ? formatARS(r.total) : '—'}</td>
      </tr>
    `).join('')

    const filtrosHtml = filtros.length
      ? `<p style="margin:4px 0 0;color:#374151;font-size:12px">${filtros.join(' · ')}</p>`
      : ''

    const html = `<!DOCTYPE html>
<html><head><title>Listado Remitos</title></head>
<body style="font-family:sans-serif;padding:20px;color:#1f2937">
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
    <img src="${logoSrc}" alt="Logo" style="width:48px;height:48px;object-fit:contain;border-radius:6px;border:1px solid #e5e7eb" onerror="this.style.display='none'" />
    <div>
      <h2 style="margin:0">Listado Remitos</h2>
      ${sucursalNombre ? `<p style="margin:2px 0 0;color:#6b7280;font-size:13px">${sucursalNombre}</p>` : ''}
    </div>
    <div style="margin-left:auto;text-align:right">
      <p style="margin:0;color:#6b7280;font-size:13px">${hoy}</p>
      <p style="margin:2px 0 0;color:#9ca3af;font-size:11px">${remitos.length} remito(s)</p>
    </div>
  </div>
  ${filtrosHtml}
  <table style="width:100%;border-collapse:collapse;margin-top:12px">
    <thead>
      <tr style="background:#f3f4f6">
        <th style="padding:8px 10px;text-align:left;font-size:12px;border-bottom:2px solid #d1d5db">N°</th>
        <th style="padding:8px 10px;text-align:left;font-size:12px;border-bottom:2px solid #d1d5db">Fecha</th>
        <th style="padding:8px 10px;text-align:left;font-size:12px;border-bottom:2px solid #d1d5db">Tipo</th>
        <th style="padding:8px 10px;text-align:left;font-size:12px;border-bottom:2px solid #d1d5db">Origen / Destino</th>
        <th style="padding:8px 10px;text-align:left;font-size:12px;border-bottom:2px solid #d1d5db">Estado</th>
        <th style="padding:8px 10px;text-align:right;font-size:12px;border-bottom:2px solid #d1d5db">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="padding:10px;text-align:right;font-weight:bold;font-size:13px;border-top:2px solid #374151">TOTAL</td>
        <td style="padding:10px;text-align:right;font-weight:bold;font-size:13px;border-top:2px solid #374151">${grandTotal > 0 ? formatARS(grandTotal) : '—'}</td>
      </tr>
    </tfoot>
  </table>
  <script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}</script>
</body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Stock — Remitos</h2>
        <div className="flex items-center gap-2">
          {remitos.length > 0 && (
            <Button variant="outline" size="sm" onClick={handlePrintList}>
              <Printer className="w-4 h-4 mr-1" />
              Imprimir listado
            </Button>
          )}
          {canWrite && can('inventario.remitos.crear') && (
            <Link href="/dashboard/inventario/remitos/nuevo" className={buttonVariants()}>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo remito
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-end gap-4 mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Desde</label>
          <Input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Hasta</label>
          <Input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      <div className="flex items-end gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Tipo</label>
          <Select value={tipo} onValueChange={(v) => { if (v) setTipo(v) }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="salida">Salida</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Estado</label>
          <Select value={estado} onValueChange={(v) => { if (v) setEstado(v) }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="confirmado">Confirmado</SelectItem>
              <SelectItem value="anulado">Anulado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Origen / Destino</label>
          <Select value={contraparteTipo} onValueChange={(v) => { if (v) setContraparteTipo(v) }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="sucursal">Sucursal</SelectItem>
              <SelectItem value="proveedor">Proveedor</SelectItem>
              <SelectItem value="persona">Persona</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar nombre…"
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            className="w-52"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">N°</TableHead>
              <TableHead className="w-28">Tipo</TableHead>
              <TableHead className="w-32">Fecha</TableHead>
              {showSucursal && <TableHead className="w-40">Sucursal</TableHead>}
              <TableHead>Origen / Destino</TableHead>
              <TableHead className="w-32 text-right">Total</TableHead>
              <TableHead className="w-32">Estado</TableHead>
              <TableHead className="w-36"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={showSucursal ? 8 : 7} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : remitos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showSucursal ? 8 : 7} className="text-center py-8 text-gray-400">Sin remitos</TableCell>
              </TableRow>
            ) : remitos.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono font-medium text-sm">{r.numero}</TableCell>
                <TableCell>
                  <Badge variant={r.tipo === 'entrada' ? 'default' : 'secondary'}>
                    {TIPO_LABELS[r.tipo]}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-600 text-sm">{formatFecha(r.fecha)}</TableCell>
                {showSucursal && (
                  <TableCell className="text-xs text-gray-500">{r.nombre_sucursal ?? '—'}</TableCell>
                )}
                <TableCell className="text-sm">
                  <span className="text-gray-400 text-xs mr-1">{CONTRAPARTE_LABELS[r.contraparte_tipo]}</span>
                  <span className="text-gray-700">{r.contraparte_display}</span>
                </TableCell>
                <TableCell className="text-sm text-right font-medium">
                  {r.total > 0 ? formatARS(r.total) : '—'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={r.estado === 'confirmado' ? 'default' : r.estado === 'anulado' ? 'destructive' : 'outline'}
                  >
                    {ESTADO_LABELS[r.estado]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    <Link
                      href={`/dashboard/inventario/remitos/${r.id}`}
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                      title="Ver detalle"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Ver
                    </Link>
                    <Link
                      href={`/dashboard/inventario/remitos/${r.id}/print`}
                      target="_blank"
                      className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                      title="Imprimir"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </Link>
                    {canWrite && can('inventario.remitos.crear') && (
                      <Link
                        href={`/dashboard/inventario/remitos/${r.id}${r.estado !== 'anulado' ? '/editar' : ''}`}
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Modificar
                      </Link>
                    )}
                    {canWrite && can('inventario.remitos.confirmar') && r.estado === 'borrador' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-green-700 hover:text-green-800 hover:bg-green-50"
                        disabled={confirmandoId === r.id}
                        onClick={() => handleConfirmar(r.id)}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        {confirmandoId === r.id ? '…' : 'Confirmar'}
                      </Button>
                    )}
                    {canWrite && can('inventario.remitos.anular') && r.estado === 'confirmado' && (
                      <button
                        onClick={() => setAnulandoRemito(r)}
                        title="Anular remito"
                        className="p-1.5 rounded-md text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isAdmin && canWrite && ['borrador', 'anulado'].includes(r.estado) && (
                      <button
                        onClick={() => setDeletingRemito(r)}
                        title="Eliminar remito"
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {remitos.length > 0 && (
              <TableRow className="bg-gray-50 font-semibold">
                <TableCell colSpan={showSucursal ? 6 : 5} className="text-right text-sm">TOTAL</TableCell>
                <TableCell className="text-right text-sm">{formatARS(grandTotal)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirmar eliminación */}
      <Dialog open={!!deletingRemito} onOpenChange={open => { if (!open) setDeletingRemito(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar remito — {deletingRemito?.numero}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-1">
            Esta acción es irreversible. ¿Confirmás que querés eliminar el remito <span className="font-mono font-medium">{deletingRemito?.numero}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingRemito(null)} disabled={confirmingDelete}>Cancelar</Button>
            <Button variant="destructive" onClick={handleEliminar} disabled={confirmingDelete}>
              {confirmingDelete ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar anulación */}
      <Dialog open={!!anulandoRemito} onOpenChange={open => { if (!open) setAnulandoRemito(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Anular remito — {anulandoRemito?.numero}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-1">
            Se revertirá el stock y los movimientos asociados. ¿Confirmás que querés anular el remito <span className="font-mono font-medium">{anulandoRemito?.numero}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnulandoRemito(null)} disabled={confirmingAnular}>Cancelar</Button>
            <Button variant="destructive" onClick={handleAnular} disabled={confirmingAnular}>
              {confirmingAnular ? 'Anulando...' : 'Anular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
