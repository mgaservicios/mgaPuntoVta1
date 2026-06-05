'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'

type Categoria = { id: number; nombre: string }
type Subcategoria = { id: number; nombre: string; activo: boolean; categoria_id: number; categorias: { nombre: string } | null }

export default function SubcategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroCat, setFiltroCat] = useState<string>('todas')
  const [nueva, setNueva] = useState('')
  const [nuevaCatId, setNuevaCatId] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/dashboard/categorias')
      .then((r) => r.json())
      .then((d) => setCategorias(Array.isArray(d) ? d : []))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = filtroCat !== 'todas' ? `?categoria_id=${filtroCat}` : ''
    fetch(`/api/dashboard/subcategorias${params}`)
      .then((r) => r.json())
      .then((d) => { setSubcategorias(Array.isArray(d) ? d : []); setLoading(false) })
  }, [filtroCat])

  useEffect(() => { if (editId !== null) editRef.current?.focus() }, [editId])

  async function handleCrear() {
    if (!nueva.trim() || !nuevaCatId) return
    setCreando(true)
    const res = await fetch('/api/dashboard/subcategorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nueva.trim(), categoria_id: parseInt(nuevaCatId) }),
    })
    if (res.ok) {
      const data = await res.json()
      setSubcategorias((prev) => [...prev, data])
      setNueva('')
      toast.success('Subcategoría creada')
    } else {
      toast.error('Error al crear')
    }
    setCreando(false)
  }

  async function handleEditar(id: number) {
    if (!editNombre.trim()) { setEditId(null); return }
    const res = await fetch(`/api/dashboard/subcategorias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editNombre.trim() }),
    })
    if (res.ok) {
      setSubcategorias((prev) => prev.map((s) => s.id === id ? { ...s, nombre: editNombre.trim() } : s))
      toast.success('Subcategoría actualizada')
    } else {
      toast.error('Error al actualizar')
    }
    setEditId(null)
  }

  async function handleEliminar() {
    if (!confirmId) return
    setEliminando(true)
    const res = await fetch(`/api/dashboard/subcategorias/${confirmId}`, { method: 'DELETE' })
    if (res.ok) {
      setSubcategorias((prev) => prev.filter((s) => s.id !== confirmId))
      toast.success('Subcategoría desactivada')
    } else {
      toast.error('Error al eliminar')
    }
    setEliminando(false)
    setConfirmId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Subcategorías</h2>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Input placeholder="Nueva subcategoría…" value={nueva} onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCrear()} className="max-w-xs" />
        <Select value={nuevaCatId ?? ''} onValueChange={(v) => setNuevaCatId(v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoría…" /></SelectTrigger>
          <SelectContent>
            {categorias.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={handleCrear} disabled={creando || !nueva.trim() || !nuevaCatId}>
          <Plus className="w-4 h-4 mr-2" />Agregar
        </Button>
      </div>

      <div className="mb-4 w-56">
        <Select value={filtroCat} onValueChange={(v) => setFiltroCat(v ?? 'todas')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {categorias.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-400">Cargando…</TableCell></TableRow>
            ) : subcategorias.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-400">Sin subcategorías</TableCell></TableRow>
            ) : subcategorias.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  {editId === s.id ? (
                    <div className="flex gap-2 items-center">
                      <Input ref={editRef} value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEditar(s.id); if (e.key === 'Escape') setEditId(null) }}
                        className="h-8 max-w-xs" />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleEditar(s.id)}><Check className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
                    </div>
                  ) : (
                    <span className="font-medium">{s.nombre}</span>
                  )}
                </TableCell>
                <TableCell className="text-gray-500 text-sm">{s.categorias?.nombre ?? '—'}</TableCell>
                <TableCell><Badge variant={s.activo ? 'default' : 'secondary'}>{s.activo ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => { setEditId(s.id); setEditNombre(s.nombre) }}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setConfirmId(s.id)}><X className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog open={confirmId !== null} title="Desactivar subcategoría"
        description="La subcategoría quedará inactiva." confirmLabel="Desactivar"
        loading={eliminando} onConfirm={handleEliminar} onCancel={() => setConfirmId(null)} />
    </div>
  )
}
