'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import { usePermissions } from '@/components/PermissionsProvider'

type AtributoValor = { id: number; atributo_tipo_id: number; valor: string; activo: boolean; orden: number }
type Atributo = { id: number; nombre: string; activo: boolean; valores: AtributoValor[] }

export default function AtributosPage() {
  const { can } = usePermissions()
  const [atributos, setAtributos] = useState<Atributo[]>([])
  const [loading, setLoading] = useState(true)

  // Nuevo tipo
  const [nuevoTipo, setNuevoTipo] = useState('')
  const [creandoTipo, setCreandoTipo] = useState(false)

  // Edición de tipo
  const [editTipoId, setEditTipoId] = useState<number | null>(null)
  const [editTipoNombre, setEditTipoNombre] = useState('')
  const editTipoRef = useRef<HTMLInputElement>(null)

  // Confirmación eliminar tipo
  const [confirmTipoId, setConfirmTipoId] = useState<number | null>(null)
  const [eliminandoTipo, setEliminandoTipo] = useState(false)

  // Expand/collapse
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  // Nuevo valor por tipo
  const [nuevoValor, setNuevoValor] = useState<Record<number, string>>({})
  const [creandoValor, setCreandoValor] = useState<number | null>(null)

  // Edición de valor
  const [editValorId, setEditValorId] = useState<number | null>(null)
  const [editValorTexto, setEditValorTexto] = useState('')
  const editValorRef = useRef<HTMLInputElement>(null)

  // Confirmación eliminar valor
  const [confirmValorId, setConfirmValorId] = useState<number | null>(null)
  const [eliminandoValor, setEliminandoValor] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/atributo-tipos').then(r => r.json()),
      fetch('/api/dashboard/atributo-valores').then(r => r.json()),
    ]).then(([tipos, valores]) => {
      const tiposArr: Omit<Atributo, 'valores'>[] = Array.isArray(tipos) ? tipos : []
      const valoresArr: AtributoValor[] = Array.isArray(valores) ? valores : []
      setAtributos(
        tiposArr.map(t => ({
          ...t,
          valores: valoresArr.filter(v => v.atributo_tipo_id === t.id),
        }))
      )
      setLoading(false)
    })
  }, [])

  useEffect(() => { if (editTipoId !== null) editTipoRef.current?.focus() }, [editTipoId])
  useEffect(() => { if (editValorId !== null) editValorRef.current?.focus() }, [editValorId])

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Tipo ──────────────────────────────────────────────────────────────────────

  async function handleCrearTipo() {
    if (!nuevoTipo.trim()) return
    setCreandoTipo(true)
    const res = await fetch('/api/dashboard/atributo-tipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevoTipo.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setAtributos(prev => [...prev, { ...data, valores: [] }])
      setExpanded(prev => new Set([...prev, data.id]))
      setNuevoTipo('')
      toast.success('Atributo creado')
    } else {
      toast.error('Error al crear')
    }
    setCreandoTipo(false)
  }

  async function handleEditarTipo(id: number) {
    if (!editTipoNombre.trim()) { setEditTipoId(null); return }
    const res = await fetch(`/api/dashboard/atributo-tipos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editTipoNombre.trim() }),
    })
    if (res.ok) {
      setAtributos(prev => prev.map(a => a.id === id ? { ...a, nombre: editTipoNombre.trim() } : a))
      toast.success('Atributo actualizado')
    } else {
      toast.error('Error al actualizar')
    }
    setEditTipoId(null)
  }

  async function handleEliminarTipo() {
    if (!confirmTipoId) return
    setEliminandoTipo(true)
    const res = await fetch(`/api/dashboard/atributo-tipos/${confirmTipoId}`, { method: 'DELETE' })
    if (res.ok) {
      setAtributos(prev => prev.filter(a => a.id !== confirmTipoId))
      toast.success('Atributo desactivado')
    } else {
      toast.error('Error al eliminar')
    }
    setEliminandoTipo(false)
    setConfirmTipoId(null)
  }

  // ── Valor ─────────────────────────────────────────────────────────────────────

  async function handleCrearValor(tipoId: number) {
    const texto = nuevoValor[tipoId]?.trim()
    if (!texto) return
    setCreandoValor(tipoId)
    const res = await fetch('/api/dashboard/atributo-valores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atributo_tipo_id: tipoId, valor: texto }),
    })
    if (res.ok) {
      const data: AtributoValor = await res.json()
      setAtributos(prev => prev.map(a =>
        a.id === tipoId ? { ...a, valores: [...a.valores, data] } : a
      ))
      setNuevoValor(prev => ({ ...prev, [tipoId]: '' }))
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al crear valor')
    }
    setCreandoValor(null)
  }

  async function handleEditarValor(id: number, tipoId: number) {
    if (!editValorTexto.trim()) { setEditValorId(null); return }
    const res = await fetch(`/api/dashboard/atributo-valores/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: editValorTexto.trim() }),
    })
    if (res.ok) {
      setAtributos(prev => prev.map(a =>
        a.id !== tipoId ? a : {
          ...a,
          valores: a.valores.map(v => v.id === id ? { ...v, valor: editValorTexto.trim() } : v),
        }
      ))
    } else {
      toast.error('Error al actualizar')
    }
    setEditValorId(null)
  }

  async function handleEliminarValor() {
    if (!confirmValorId) return
    setEliminandoValor(true)
    const res = await fetch(`/api/dashboard/atributo-valores/${confirmValorId}`, { method: 'DELETE' })
    if (res.ok) {
      setAtributos(prev => prev.map(a => ({
        ...a,
        valores: a.valores.filter(v => v.id !== confirmValorId),
      })))
    } else {
      toast.error('Error al eliminar')
    }
    setEliminandoValor(false)
    setConfirmValorId(null)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Atributos de variantes</h2>
      </div>

      {can('altas.atributos.crear') && (
        <div className="flex gap-2 mb-6">
          <Input
            placeholder="Nuevo atributo (ej: Color, Talle)…"
            value={nuevoTipo}
            onChange={e => setNuevoTipo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCrearTipo()}
            className="max-w-sm"
          />
          <Button onClick={handleCrearTipo} disabled={creandoTipo || !nuevoTipo.trim()}>
            <Plus className="w-4 h-4 mr-2" />Agregar
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando…</p>
      ) : atributos.length === 0 ? (
        <p className="text-gray-400 text-sm">Sin atributos</p>
      ) : (
        <div className="space-y-2">
          {atributos.map(a => {
            const abierto = expanded.has(a.id)
            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* ── Cabecera del tipo ── */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(a.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {abierto
                      ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    }
                    {editTipoId === a.id ? (
                      <Input
                        ref={editTipoRef}
                        value={editTipoNombre}
                        onChange={e => setEditTipoNombre(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleEditarTipo(a.id)
                          if (e.key === 'Escape') setEditTipoId(null)
                        }}
                        className="h-7 text-sm max-w-[200px]"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="font-medium text-gray-800">{a.nombre}</span>
                    )}
                    <Badge variant={a.activo ? 'default' : 'secondary'} className="text-xs ml-1 shrink-0">
                      {a.valores.length} valor{a.valores.length !== 1 ? 'es' : ''}
                    </Badge>
                  </button>
                  <div className="flex gap-1 shrink-0">
                    {editTipoId === a.id ? (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleEditarTipo(a.id)}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditTipoId(null)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {can('altas.atributos.editar') && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditTipoId(a.id); setEditTipoNombre(a.nombre) }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {can('altas.atributos.eliminar') && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setConfirmTipoId(a.id)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* ── Valores (expandido) ── */}
                {abierto && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-2 bg-gray-50/50">
                    {a.valores.length === 0 ? (
                      <p className="text-xs text-gray-400">Sin valores. Agregá uno abajo.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {a.valores.map(v => (
                          <div key={v.id} className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1">
                            {editValorId === v.id ? (
                              <>
                                <Input
                                  ref={editValorRef}
                                  value={editValorTexto}
                                  onChange={e => setEditValorTexto(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleEditarValor(v.id, a.id)
                                    if (e.key === 'Escape') setEditValorId(null)
                                  }}
                                  className="h-5 text-xs w-24 border-0 p-0 focus-visible:ring-0 bg-transparent"
                                />
                                <button type="button" onClick={() => handleEditarValor(v.id, a.id)} className="text-green-500 hover:text-green-700">
                                  <Check className="w-3 h-3" />
                                </button>
                                <button type="button" onClick={() => setEditValorId(null)} className="text-gray-400 hover:text-gray-600">
                                  <X className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-gray-700">{v.valor}</span>
                                {can('altas.atributos.editar') && (
                                  <button type="button" onClick={() => { setEditValorId(v.id); setEditValorTexto(v.valor) }} className="text-gray-300 hover:text-indigo-500 transition-colors ml-0.5">
                                    <Pencil className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                {can('altas.atributos.eliminar') && (
                                  <button type="button" onClick={() => setConfirmValorId(v.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {can('altas.atributos.crear') && (
                      <div className="flex gap-2 pt-1">
                        <Input
                          placeholder={`Nuevo valor de ${a.nombre}…`}
                          value={nuevoValor[a.id] ?? ''}
                          onChange={e => setNuevoValor(prev => ({ ...prev, [a.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleCrearValor(a.id)}
                          className="h-8 text-sm max-w-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={creandoValor === a.id || !nuevoValor[a.id]?.trim()}
                          onClick={() => handleCrearValor(a.id)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Agregar
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmTipoId !== null}
        title="Desactivar atributo"
        description="El atributo quedará inactivo y no aparecerá al crear variantes."
        confirmLabel="Desactivar"
        loading={eliminandoTipo}
        onConfirm={handleEliminarTipo}
        onCancel={() => setConfirmTipoId(null)}
      />

      <ConfirmDialog
        open={confirmValorId !== null}
        title="Eliminar valor"
        description="El valor quedará inactivo y no aparecerá en los selectores."
        confirmLabel="Eliminar"
        loading={eliminandoValor}
        onConfirm={handleEliminarValor}
        onCancel={() => setConfirmValorId(null)}
      />
    </div>
  )
}
