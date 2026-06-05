'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Check, Trash2 } from 'lucide-react'
import { buttonVariants, Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

type RemitoRow = Remito & { contraparte_display: string; nombre_sucursal?: string | null }

const TIPO_LABELS: Record<string, string> = { entrada: 'Entrada', salida: 'Salida' }
const ESTADO_LABELS: Record<string, string> = { borrador: 'Borrador', confirmado: 'Confirmado', anulado: 'Anulado' }
const CONTRAPARTE_LABELS: Record<string, string> = { sucursal: 'Sucursal', proveedor: 'Proveedor', persona: 'Persona' }

export default function RemitosClient({ isAdmin }: { isAdmin: boolean }) {
  const [remitos, setRemitos] = useState<RemitoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tipo, setTipo] = useState('todos')
  const [estado, setEstado] = useState('todos')
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null)

  // Eliminar remito
  const [deletingRemito, setDeletingRemito] = useState<RemitoRow | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const fetchRemitos = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (tipo !== 'todos') params.set('tipo', tipo)
    if (estado !== 'todos') params.set('estado', estado)
    const res = await fetch(`/api/dashboard/stock/remitos?${params}`)
    const data = await res.json()
    setRemitos(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [tipo, estado])

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

  function formatFecha(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Stock — Remitos</h2>
        <Link href="/dashboard/inventario/remitos/nuevo" className={buttonVariants()}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo remito
        </Link>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="w-44">
          <Select value={tipo} onValueChange={(v) => { if (v) setTipo(v) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              <SelectItem value="entrada">Entrada</SelectItem>
              <SelectItem value="salida">Salida</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={estado} onValueChange={(v) => { if (v) setEstado(v) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="confirmado">Confirmado</SelectItem>
              <SelectItem value="anulado">Anulado</SelectItem>
            </SelectContent>
          </Select>
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
              <TableHead className="w-32">Estado</TableHead>
              <TableHead className="w-36"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={showSucursal ? 7 : 6} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : remitos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showSucursal ? 7 : 6} className="text-center py-8 text-gray-400">Sin remitos</TableCell>
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
                      href={`/dashboard/inventario/remitos/${r.id}${r.estado !== 'anulado' ? '/editar' : ''}`}
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Modificar
                    </Link>
                    {r.estado === 'borrador' && (
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
                    {isAdmin && ['borrador', 'anulado'].includes(r.estado) && (
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
    </div>
  )
}
