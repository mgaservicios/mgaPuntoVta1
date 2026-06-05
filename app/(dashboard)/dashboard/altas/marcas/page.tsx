'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'

type Marca = { id: number; nombre: string; activo: boolean }

export default function MarcasPage() {
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [loading, setLoading] = useState(true)
  const [nueva, setNueva] = useState('')
  const [creando, setCreando] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const editRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/dashboard/marcas')
      .then((r) => r.json())
      .then((d) => { setMarcas(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  useEffect(() => { if (editId !== null) editRef.current?.focus() }, [editId])

  async function handleCrear() {
    if (!nueva.trim()) return
    setCreando(true)
    const res = await fetch('/api/dashboard/marcas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nueva.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setMarcas((prev) => [...prev, data])
      setNueva('')
      toast.success('Marca creada')
    } else {
      toast.error('Error al crear')
    }
    setCreando(false)
  }

  async function handleEditar(id: number) {
    if (!editNombre.trim()) { setEditId(null); return }
    const res = await fetch(`/api/dashboard/marcas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: editNombre.trim() }),
    })
    if (res.ok) {
      setMarcas((prev) => prev.map((m) => m.id === id ? { ...m, nombre: editNombre.trim() } : m))
      toast.success('Marca actualizada')
    } else {
      toast.error('Error al actualizar')
    }
    setEditId(null)
  }

  async function handleEliminar() {
    if (!confirmId) return
    setEliminando(true)
    const res = await fetch(`/api/dashboard/marcas/${confirmId}`, { method: 'DELETE' })
    if (res.ok) {
      setMarcas((prev) => prev.filter((m) => m.id !== confirmId))
      toast.success('Marca desactivada')
    } else {
      toast.error('Error al eliminar')
    }
    setEliminando(false)
    setConfirmId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Marcas</h2>
      </div>

      <div className="flex gap-2 mb-6">
        <Input
          placeholder="Nueva marca…"
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
              <TableHead>Estado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-gray-400">Cargando…</TableCell></TableRow>
            ) : marcas.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-gray-400">Sin marcas</TableCell></TableRow>
            ) : marcas.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  {editId === m.id ? (
                    <div className="flex gap-2 items-center">
                      <Input
                        ref={editRef}
                        value={editNombre}
                        onChange={(e) => setEditNombre(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleEditar(m.id); if (e.key === 'Escape') setEditId(null) }}
                        className="h-8 max-w-xs"
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleEditar(m.id)}><Check className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
                    </div>
                  ) : (
                    <span className="font-medium">{m.nombre}</span>
                  )}
                </TableCell>
                <TableCell><Badge variant={m.activo ? 'default' : 'secondary'}>{m.activo ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => { setEditId(m.id); setEditNombre(m.nombre) }}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => setConfirmId(m.id)}><X className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="Desactivar marca"
        description="La marca quedará inactiva. Podés reactivarla editándola."
        confirmLabel="Desactivar"
        loading={eliminando}
        onConfirm={handleEliminar}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
