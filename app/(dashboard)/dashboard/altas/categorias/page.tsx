'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'

type Subcategoria = { id: number; nombre: string; activo: boolean }
type Categoria = { id: number; nombre: string; activo: boolean; subcategorias?: Subcategoria[] }

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [nueva, setNueva] = useState('')
  const [creando, setCreando] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/dashboard/categorias')
      .then((r) => r.json())
      .then((d) => { setCategorias(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  useEffect(() => { if (editId !== null) editRef.current?.focus() }, [editId])

  async function handleCrear() {
    if (!nueva.trim()) return
    setCreando(true)
    const res = await fetch('/api/dashboard/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nueva.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setCategorias((prev) => [...prev, data])
      setNueva('')
      toast.success('Categoría creada')
    } else {
      toast.error('Error al crear')
    }
    setCreando(false)
  }

  async function handleEditar(id: number) {
    if (!editNombre.trim()) { setEditId(null); return }
    const res = await fetch(`/api/dashboard/categorias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editNombre.trim() }),
    })
    if (res.ok) {
      setCategorias((prev) => prev.map((c) => c.id === id ? { ...c, nombre: editNombre.trim() } : c))
      toast.success('Categoría actualizada')
    } else {
      toast.error('Error al actualizar')
    }
    setEditId(null)
  }

  async function handleEliminar() {
    if (!confirmId) return
    setEliminando(true)
    const res = await fetch(`/api/dashboard/categorias/${confirmId}`, { method: 'DELETE' })
    if (res.ok) {
      setCategorias((prev) => prev.filter((c) => c.id !== confirmId))
      toast.success('Categoría desactivada')
    } else {
      toast.error('Error al eliminar')
    }
    setEliminando(false)
    setConfirmId(null)
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Categorías</h2>
      </div>

      <div className="flex gap-2 mb-6">
        <Input
          placeholder="Nueva categoría…"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCrear()}
          className="max-w-sm"
        />
        <Button onClick={handleCrear} disabled={creando || !nueva.trim()}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Subcategorías</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-400">Cargando…</TableCell></TableRow>
            ) : categorias.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-400">Sin categorías</TableCell></TableRow>
            ) : categorias.map((c) => (
              <>
                <TableRow key={c.id}>
                  <TableCell>
                    {editId === c.id ? (
                      <div className="flex gap-2 items-center">
                        <Input ref={editRef} value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleEditar(c.id); if (e.key === 'Escape') setEditId(null) }}
                          className="h-8 max-w-xs" />
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleEditar(c.id)}><Check className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
                      </div>
                    ) : (
                      <span className="font-medium">{c.nombre}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(c.subcategorias?.length ?? 0) > 0 ? (
                      <button onClick={() => toggleExpand(c.id)} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                        {expanded.has(c.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        {c.subcategorias!.length} subcategoría{c.subcategorias!.length !== 1 ? 's' : ''}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell><Badge variant={c.activo ? 'default' : 'secondary'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => { setEditId(c.id); setEditNombre(c.nombre) }}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setConfirmId(c.id)}><X className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expanded.has(c.id) && c.subcategorias?.map((s) => (
                  <TableRow key={`sub-${s.id}`} className="bg-gray-50/60">
                    <TableCell className="pl-10 text-sm text-gray-600">
                      <span className="text-gray-300 mr-1.5">└</span>{s.nombre}
                    </TableCell>
                    <TableCell />
                    <TableCell><Badge variant={s.activo ? 'default' : 'secondary'} className="text-xs">{s.activo ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="Desactivar categoría"
        description="La categoría quedará inactiva junto con sus subcategorías."
        confirmLabel="Desactivar"
        loading={eliminando}
        onConfirm={handleEliminar}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
