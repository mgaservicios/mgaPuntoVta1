'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'

type Atributo = { id: number; nombre: string; activo: boolean }

export default function AtributosPage() {
  const [atributos, setAtributos] = useState<Atributo[]>([])
  const [loading, setLoading] = useState(true)
  const [nueva, setNueva] = useState('')
  const [creando, setCreando] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/dashboard/atributo-tipos')
      .then((r) => r.json())
      .then((d) => { setAtributos(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  useEffect(() => { if (editId !== null) editRef.current?.focus() }, [editId])

  async function handleCrear() {
    if (!nueva.trim()) return
    setCreando(true)
    const res = await fetch('/api/dashboard/atributo-tipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nueva.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setAtributos((prev) => [...prev, data])
      setNueva('')
      toast.success('Atributo creado')
    } else {
      toast.error('Error al crear')
    }
    setCreando(false)
  }

  async function handleEditar(id: number) {
    if (!editNombre.trim()) { setEditId(null); return }
    const res = await fetch(`/api/dashboard/atributo-tipos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editNombre.trim() }),
    })
    if (res.ok) {
      setAtributos((prev) => prev.map((a) => a.id === id ? { ...a, nombre: editNombre.trim() } : a))
      toast.success('Atributo actualizado')
    } else {
      toast.error('Error al actualizar')
    }
    setEditId(null)
  }

  async function handleEliminar() {
    if (!confirmId) return
    setEliminando(true)
    const res = await fetch(`/api/dashboard/atributo-tipos/${confirmId}`, { method: 'DELETE' })
    if (res.ok) {
      setAtributos((prev) => prev.filter((a) => a.id !== confirmId))
      toast.success('Atributo desactivado')
    } else {
      toast.error('Error al eliminar')
    }
    setEliminando(false)
    setConfirmId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Atributos de variantes</h2>
      </div>

      <div className="flex gap-2 mb-6">
        <Input placeholder="Nuevo atributo (ej: Color, Talle)…" value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCrear()} className="max-w-sm" />
        <Button onClick={handleCrear} disabled={creando || !nueva.trim()}>
          <Plus className="w-4 h-4 mr-2" />Agregar
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-gray-400">Cargando…</TableCell></TableRow>
            ) : atributos.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-gray-400">Sin atributos</TableCell></TableRow>
            ) : atributos.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  {editId === a.id ? (
                    <div className="flex gap-2 items-center">
                      <Input ref={editRef} value={editNombre} onChange={(e) => setEditNombre(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEditar(a.id); if (e.key === 'Escape') setEditId(null) }}
                        className="h-8 max-w-xs" />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleEditar(a.id)}><Check className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
                    </div>
                  ) : (
                    <span className="font-medium">{a.nombre}</span>
                  )}
                </TableCell>
                <TableCell><Badge variant={a.activo ? 'default' : 'secondary'}>{a.activo ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => { setEditId(a.id); setEditNombre(a.nombre) }}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setConfirmId(a.id)}><X className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog open={confirmId !== null} title="Desactivar atributo"
        description="El atributo quedará inactivo y no aparecerá al crear variantes."
        confirmLabel="Desactivar" loading={eliminando}
        onConfirm={handleEliminar} onCancel={() => setConfirmId(null)} />
    </div>
  )
}
