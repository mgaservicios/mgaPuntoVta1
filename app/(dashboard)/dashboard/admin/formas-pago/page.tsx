'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { Plus, Pencil, Check, X, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { FormaPago, FormaPagoCuota, TipoFormaPago } from '@/types/formas-pago'
import { TIPO_FORMA_PAGO_LABELS } from '@/types/formas-pago'

const TIPOS: TipoFormaPago[] = ['TARJETA_CREDITO', 'TARJETA_DEBITO', 'BANCARIA', 'BILLETERA', 'MONEDA']

const TIPO_COLORS: Record<TipoFormaPago, string> = {
  TARJETA_CREDITO: 'bg-blue-100 text-blue-800',
  TARJETA_DEBITO:  'bg-indigo-100 text-indigo-800',
  BANCARIA:        'bg-amber-100 text-amber-800',
  BILLETERA:       'bg-purple-100 text-purple-800',
  MONEDA:          'bg-green-100 text-green-800',
}

interface EditState { nombre: string; tipo: TipoFormaPago; orden: string }

export default function FormasPagoPage() {
  const [formas, setFormas] = useState<FormaPago[]>([])
  const [loading, setLoading] = useState(true)

  // Nueva forma
  const [nuevaNombre, setNuevaNombre] = useState('')
  const [nuevaTipo, setNuevaTipo]     = useState<TipoFormaPago>('MONEDA')
  const [nuevaOrden, setNuevaOrden]   = useState('')
  const [saving, setSaving]           = useState(false)

  // Edición inline
  const [editId, setEditId]       = useState<number | null>(null)
  const [editState, setEditState] = useState<EditState>({ nombre: '', tipo: 'MONEDA', orden: '0' })

  // Expansión cuotas
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Nueva cuota
  const [nuevaCuotaMap, setNuevaCuotaMap] = useState<Record<number, { cantidad: string; recargo: string }>>({})

  const fetchFormas = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/dashboard/admin/formas-pago')
    const data = await res.json()
    setFormas(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchFormas() }, [fetchFormas])

  async function handleCreate() {
    if (!nuevaNombre.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    const res = await fetch('/api/dashboard/admin/formas-pago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevaNombre, tipo: nuevaTipo, orden: parseInt(nuevaOrden) || 0 }),
    })
    if (res.ok) {
      toast.success('Forma de pago creada')
      setNuevaNombre('')
      setNuevaTipo('MONEDA')
      setNuevaOrden('')
      fetchFormas()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error al crear')
    }
    setSaving(false)
  }

  function startEdit(f: FormaPago) {
    setEditId(f.id)
    setEditState({ nombre: f.nombre, tipo: f.tipo, orden: String(f.orden) })
  }

  async function handleSaveEdit(id: number) {
    const res = await fetch(`/api/dashboard/admin/formas-pago/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editState.nombre, tipo: editState.tipo, orden: parseInt(editState.orden) || 0 }),
    })
    if (res.ok) {
      toast.success('Guardado')
      setEditId(null)
      fetchFormas()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error al guardar')
    }
  }

  async function handleToggleActivo(f: FormaPago) {
    const res = await fetch(`/api/dashboard/admin/formas-pago/${f.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !f.activo }),
    })
    if (res.ok) fetchFormas()
    else toast.error('Error al actualizar')
  }

  async function handleAddCuota(formaId: number) {
    const c = nuevaCuotaMap[formaId]
    if (!c?.cantidad) { toast.error('Cantidad requerida'); return }
    const res = await fetch(`/api/dashboard/admin/formas-pago/${formaId}/cuotas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad_cuotas: parseInt(c.cantidad), recargo_pct: parseFloat(c.recargo || '0') }),
    })
    if (res.ok) {
      toast.success('Cuota agregada')
      setNuevaCuotaMap(prev => ({ ...prev, [formaId]: { cantidad: '', recargo: '' } }))
      fetchFormas()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Error al agregar cuota')
    }
  }

  async function handleDeleteCuota(formaId: number, cuotaId: number) {
    if (!confirm('¿Eliminar esta cuota?')) return
    const res = await fetch(`/api/dashboard/admin/formas-pago/${formaId}/cuotas?cuota_id=${cuotaId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Cuota eliminada'); fetchFormas() }
    else toast.error('Error al eliminar')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Formas de pago</h2>
      </div>

      {/* Formulario nueva forma */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Nueva forma de pago</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
            <Input
              value={nuevaNombre}
              onChange={e => setNuevaNombre(e.target.value)}
              placeholder="Ej: Visa, Naranja X…"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
            <select
              value={nuevaTipo}
              onChange={e => setNuevaTipo(e.target.value as TipoFormaPago)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {TIPOS.map(t => <option key={t} value={t}>{TIPO_FORMA_PAGO_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="w-20">
            <label className="text-xs text-gray-500 mb-1 block">Orden</label>
            <Input
              type="number"
              value={nuevaOrden}
              onChange={e => setNuevaOrden(e.target.value)}
              placeholder="0"
            />
          </div>
          <Button onClick={handleCreate} disabled={saving}>
            <Plus className="w-4 h-4 mr-1" />
            Agregar
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="w-16 text-center">Orden</TableHead>
              <TableHead className="w-24 text-center">Estado</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : formas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-400">Sin formas de pago</TableCell>
              </TableRow>
            ) : formas.map(f => (
              <Fragment key={f.id}>
                <TableRow className={!f.activo ? 'opacity-50' : ''}>
                  {/* Expansión solo para tarjetas de crédito */}
                  <TableCell>
                    {f.tipo === 'TARJETA_CREDITO' && (
                      <button
                        onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {expandedId === f.id
                          ? <ChevronDown className="w-4 h-4" />
                          : <ChevronRight className="w-4 h-4" />
                        }
                      </button>
                    )}
                  </TableCell>

                  {/* Nombre — editable */}
                  <TableCell>
                    {editId === f.id ? (
                      <Input
                        value={editState.nombre}
                        onChange={e => setEditState(s => ({ ...s, nombre: e.target.value }))}
                        className="h-7 text-sm"
                      />
                    ) : (
                      <span className="font-medium">{f.nombre}</span>
                    )}
                  </TableCell>

                  {/* Tipo — editable */}
                  <TableCell>
                    {editId === f.id ? (
                      <select
                        value={editState.tipo}
                        onChange={e => setEditState(s => ({ ...s, tipo: e.target.value as TipoFormaPago }))}
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {TIPOS.map(t => <option key={t} value={t}>{TIPO_FORMA_PAGO_LABELS[t]}</option>)}
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TIPO_COLORS[f.tipo]}`}>
                        {TIPO_FORMA_PAGO_LABELS[f.tipo]}
                      </span>
                    )}
                  </TableCell>

                  {/* Orden */}
                  <TableCell className="text-center">
                    {editId === f.id ? (
                      <Input
                        type="number"
                        value={editState.orden}
                        onChange={e => setEditState(s => ({ ...s, orden: e.target.value }))}
                        className="h-7 text-sm w-16"
                      />
                    ) : f.orden}
                  </TableCell>

                  {/* Estado toggle */}
                  <TableCell className="text-center">
                    <button onClick={() => handleToggleActivo(f)}>
                      <Badge variant={f.activo ? 'default' : 'secondary'}>
                        {f.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </button>
                  </TableCell>

                  {/* Acciones */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {editId === f.id ? (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleSaveEdit(f.id)}>
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setEditId(null)}>
                            <X className="w-4 h-4 text-gray-500" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => startEdit(f)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>

                {/* Cuotas inline (solo TARJETA_CREDITO expandida) */}
                {f.tipo === 'TARJETA_CREDITO' && expandedId === f.id && (
                  <TableRow key={`${f.id}-cuotas`}>
                    <TableCell colSpan={6} className="bg-gray-50 p-4">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Cuotas — {f.nombre}</p>

                      {/* Tabla de cuotas */}
                      {(f.formas_pago_cuotas ?? []).length === 0 ? (
                        <p className="text-xs text-gray-400 mb-3">Sin cuotas configuradas.</p>
                      ) : (
                        <table className="text-xs mb-3 w-auto">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left pr-6 pb-1">Cuotas</th>
                              <th className="text-left pr-6 pb-1">Recargo %</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(f.formas_pago_cuotas ?? [])
                              .slice()
                              .sort((a: FormaPagoCuota, b: FormaPagoCuota) => a.cantidad_cuotas - b.cantidad_cuotas)
                              .map((c: FormaPagoCuota) => (
                                <tr key={c.id}>
                                  <td className="pr-6 py-0.5">{c.cantidad_cuotas}x</td>
                                  <td className="pr-6 py-0.5">{c.recargo_pct}%</td>
                                  <td>
                                    <button
                                      onClick={() => handleDeleteCuota(f.id, c.id)}
                                      className="text-red-400 hover:text-red-600"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      )}

                      {/* Agregar cuota */}
                      <div className="flex items-end gap-2">
                        <div>
                          <label className="text-xs text-gray-500 block mb-0.5">Cuotas</label>
                          <Input
                            type="number"
                            placeholder="1"
                            className="h-7 w-16 text-xs"
                            value={nuevaCuotaMap[f.id]?.cantidad ?? ''}
                            onChange={e => setNuevaCuotaMap(prev => ({
                              ...prev,
                              [f.id]: { ...(prev[f.id] ?? { cantidad: '', recargo: '' }), cantidad: e.target.value },
                            }))}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-0.5">Recargo %</label>
                          <Input
                            type="number"
                            placeholder="0"
                            className="h-7 w-20 text-xs"
                            value={nuevaCuotaMap[f.id]?.recargo ?? ''}
                            onChange={e => setNuevaCuotaMap(prev => ({
                              ...prev,
                              [f.id]: { ...(prev[f.id] ?? { cantidad: '', recargo: '' }), recargo: e.target.value },
                            }))}
                          />
                        </div>
                        <Button size="sm" className="h-7 text-xs" onClick={() => handleAddCuota(f.id)}>
                          <Plus className="w-3 h-3 mr-1" />
                          Agregar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
