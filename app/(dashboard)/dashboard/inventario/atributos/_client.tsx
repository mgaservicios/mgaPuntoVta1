'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, Pencil, Trash2, Check, X, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { AtributoTipo, AtributoValor } from '@/types/articulos'

interface TipoConValores extends AtributoTipo {
  valores: AtributoValor[]
}

// ─── Fila de valor editable ───────────────────────────────────────────────────

function ValorRow({
  valor,
  onUpdated,
  onDeleted,
}: {
  valor: AtributoValor
  onUpdated: (v: AtributoValor) => void
  onDeleted: (id: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(valor.valor)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  async function save() {
    if (!text.trim() || text.trim() === valor.valor) { setEditing(false); setText(valor.valor); return }
    setSaving(true)
    const res = await fetch(`/api/dashboard/atributo-valores/${valor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: text.trim() }),
    })
    if (res.ok) {
      const updated = await res.json()
      onUpdated(updated)
      toast.success('Valor actualizado')
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al actualizar')
      setText(valor.valor)
    }
    setSaving(false)
    setEditing(false)
  }

  async function del() {
    if (!confirm(`¿Eliminar "${valor.valor}"?`)) return
    const res = await fetch(`/api/dashboard/atributo-valores/${valor.id}`, { method: 'DELETE' })
    if (res.ok) { onDeleted(valor.id); toast.success('Valor eliminado') }
    else toast.error('Error al eliminar')
  }

  return (
    <div className="flex items-center gap-1.5 group">
      <GripVertical className="w-3.5 h-3.5 text-gray-200 group-hover:text-gray-400 shrink-0" />
      {editing ? (
        <>
          <Input
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setText(valor.valor) } }}
            className="h-7 text-sm flex-1"
          />
          <button type="button" onClick={save} disabled={saving} className="text-green-600 hover:text-green-700 p-0.5">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => { setEditing(false); setText(valor.valor) }} className="text-gray-400 hover:text-gray-600 p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm text-gray-700">{valor.valor}</span>
          <button type="button" onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 p-0.5 transition-opacity">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={del} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-0.5 transition-opacity">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  )
}

// ─── Card de tipo ─────────────────────────────────────────────────────────────

function TipoCard({
  tipo,
  onTipoUpdated,
  onTipoDeleted,
  onValorCreado,
  onValorUpdated,
  onValorDeleted,
}: {
  tipo: TipoConValores
  onTipoUpdated: (t: AtributoTipo) => void
  onTipoDeleted: (id: number) => void
  onValorCreado: (v: AtributoValor) => void
  onValorUpdated: (v: AtributoValor) => void
  onValorDeleted: (tipoId: number, valorId: number) => void
}) {
  const [editingNombre, setEditingNombre] = useState(false)
  const [nombre, setNombre] = useState(tipo.nombre)
  const [savingNombre, setSavingNombre] = useState(false)
  const [newValor, setNewValor] = useState('')
  const [addingValor, setAddingValor] = useState(false)
  const nombreRef = useRef<HTMLInputElement>(null)
  const newValorRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editingNombre) nombreRef.current?.focus() }, [editingNombre])
  useEffect(() => { if (addingValor) newValorRef.current?.focus() }, [addingValor])

  async function saveTipoNombre() {
    if (!nombre.trim() || nombre.trim() === tipo.nombre) { setEditingNombre(false); setNombre(tipo.nombre); return }
    setSavingNombre(true)
    const res = await fetch(`/api/dashboard/atributo-tipos/${tipo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim() }),
    })
    if (res.ok) { onTipoUpdated({ ...tipo, nombre: nombre.trim() }); toast.success('Tipo actualizado') }
    else { const err = await res.json(); toast.error(err.error ?? 'Error'); setNombre(tipo.nombre) }
    setSavingNombre(false)
    setEditingNombre(false)
  }

  async function deleteTipo() {
    if (!confirm(`¿Eliminar el tipo "${tipo.nombre}" y todos sus valores?`)) return
    const res = await fetch(`/api/dashboard/atributo-tipos/${tipo.id}`, { method: 'DELETE' })
    if (res.ok) { onTipoDeleted(tipo.id); toast.success('Tipo eliminado') }
    else toast.error('Error al eliminar')
  }

  async function crearValor() {
    if (!newValor.trim()) return
    const res = await fetch('/api/dashboard/atributo-valores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atributo_tipo_id: tipo.id, valor: newValor.trim() }),
    })
    if (res.ok) {
      const created = await res.json()
      onValorCreado(created)
      setNewValor('')
      toast.success(`"${created.valor}" agregado`)
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al crear valor')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Cabecera del tipo */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
        {editingNombre ? (
          <>
            <Input
              ref={nombreRef}
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveTipoNombre(); if (e.key === 'Escape') { setEditingNombre(false); setNombre(tipo.nombre) } }}
              className="h-7 text-sm font-medium flex-1 max-w-xs"
            />
            <button type="button" onClick={saveTipoNombre} disabled={savingNombre} className="text-green-600 hover:text-green-700">
              <Check className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => { setEditingNombre(false); setNombre(tipo.nombre) }} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-gray-800 flex-1">{tipo.nombre}</h3>
            <Badge variant="secondary" className="text-xs">{tipo.valores.length} valores</Badge>
            <button type="button" onClick={() => setEditingNombre(true)} className="text-gray-400 hover:text-indigo-600 p-0.5">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={deleteTipo} className="text-gray-400 hover:text-red-500 p-0.5">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Lista de valores */}
      <div className="p-4 space-y-1">
        {tipo.valores.length === 0 && !addingValor && (
          <p className="text-xs text-gray-400 py-1">Sin valores cargados.</p>
        )}
        {tipo.valores.map(v => (
          <ValorRow
            key={v.id}
            valor={v}
            onUpdated={onValorUpdated}
            onDeleted={(id) => onValorDeleted(tipo.id, id)}
          />
        ))}

        {/* Fila para agregar nuevo valor */}
        {addingValor ? (
          <div className="flex items-center gap-1.5 pt-1">
            <Input
              ref={newValorRef}
              value={newValor}
              onChange={e => setNewValor(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') crearValor()
                if (e.key === 'Escape') { setAddingValor(false); setNewValor('') }
              }}
              placeholder="Nuevo valor…"
              className="h-7 text-sm flex-1"
            />
            <button type="button" onClick={crearValor} className="text-green-600 hover:text-green-700 p-0.5">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => { setAddingValor(false); setNewValor('') }} className="text-gray-400 hover:text-gray-600 p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingValor(true)}
            className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 mt-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar valor
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AtributosClient({ isAdmin }: { isAdmin: boolean }) {
  const [tipos, setTipos] = useState<TipoConValores[]>([])
  const [loading, setLoading] = useState(true)
  const [newTipoNombre, setNewTipoNombre] = useState('')
  const [addingTipo, setAddingTipo] = useState(false)
  const newTipoRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (addingTipo) newTipoRef.current?.focus() }, [addingTipo])

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/atributo-tipos').then(r => r.json()),
      fetch('/api/dashboard/atributo-valores').then(r => r.json()),
    ]).then(([tiposData, valoresData]: [AtributoTipo[], AtributoValor[]]) => {
      const merged: TipoConValores[] = tiposData.map(t => ({
        ...t,
        valores: valoresData.filter(v => v.atributo_tipo_id === t.id),
      }))
      setTipos(merged)
    }).finally(() => setLoading(false))
  }, [])

  async function crearTipo() {
    if (!newTipoNombre.trim()) return
    const res = await fetch('/api/dashboard/atributo-tipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: newTipoNombre.trim() }),
    })
    if (res.ok) {
      const created: AtributoTipo = await res.json()
      setTipos(prev => [...prev, { ...created, valores: [] }])
      setNewTipoNombre('')
      setAddingTipo(false)
      toast.success(`Tipo "${created.nombre}" creado`)
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al crear tipo')
    }
  }

  function handleTipoUpdated(updated: AtributoTipo) {
    setTipos(prev => prev.map(t => t.id === updated.id ? { ...t, nombre: updated.nombre } : t))
  }

  function handleTipoDeleted(id: number) {
    setTipos(prev => prev.filter(t => t.id !== id))
  }

  function handleValorCreado(valor: AtributoValor) {
    setTipos(prev => prev.map(t =>
      t.id === valor.atributo_tipo_id ? { ...t, valores: [...t.valores, valor] } : t
    ))
  }

  function handleValorUpdated(valor: AtributoValor) {
    setTipos(prev => prev.map(t =>
      t.id === valor.atributo_tipo_id
        ? { ...t, valores: t.valores.map(v => v.id === valor.id ? valor : v) }
        : t
    ))
  }

  function handleValorDeleted(tipoId: number, valorId: number) {
    setTipos(prev => prev.map(t =>
      t.id === tipoId ? { ...t, valores: t.valores.filter(v => v.id !== valorId) } : t
    ))
  }

  if (loading) return <p className="text-gray-400 text-sm">Cargando…</p>

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Atributos de variantes</h2>
          <p className="text-xs text-gray-500 mt-0.5">Tipos de atributo (Color, Talle…) y sus valores predefinidos.</p>
        </div>
        {(isAdmin || true) && (
          addingTipo ? (
            <div className="flex items-center gap-2">
              <Input
                ref={newTipoRef}
                value={newTipoNombre}
                onChange={e => setNewTipoNombre(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') crearTipo(); if (e.key === 'Escape') { setAddingTipo(false); setNewTipoNombre('') } }}
                placeholder="Nombre del tipo…"
                className="h-8 w-48 text-sm"
              />
              <button type="button" onClick={crearTipo} className="text-green-600 hover:text-green-700">
                <Check className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => { setAddingTipo(false); setNewTipoNombre('') }} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAddingTipo(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Nuevo tipo
            </Button>
          )
        )}
      </div>

      {tipos.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Sin tipos de atributo. Creá el primero.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tipos.map(t => (
            <TipoCard
              key={t.id}
              tipo={t}
              onTipoUpdated={handleTipoUpdated}
              onTipoDeleted={handleTipoDeleted}
              onValorCreado={handleValorCreado}
              onValorUpdated={handleValorUpdated}
              onValorDeleted={handleValorDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
