'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Search, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { usePermissions } from '@/components/PermissionsProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import type { OpticaMedico } from '@/types/optica'

interface MedicoForm {
  nombre: string
  matricula: string
  telefono: string
}

const EMPTY_FORM: MedicoForm = { nombre: '', matricula: '', telefono: '' }

export default function MedicosPage() {
  const { can } = usePermissions()
  const [medicos, setMedicos] = useState<OpticaMedico[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<MedicoForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  const fetchMedicos = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const res = await fetch(`/api/dashboard/optica/medicos?${params}`)
    const data = await res.json()
    setMedicos(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [q])

  useEffect(() => {
    const t = setTimeout(fetchMedicos, 300)
    return () => clearTimeout(t)
  }, [fetchMedicos])

  function openNew() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(m: OpticaMedico) {
    setForm({ nombre: m.nombre, matricula: m.matricula ?? '', telefono: m.telefono ?? '' })
    setEditingId(m.id)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)

    const payload = {
      nombre: form.nombre.trim(),
      matricula: form.matricula.trim() || null,
      telefono: form.telefono.trim() || null,
    }

    if (editingId) {
      const res = await fetch(`/api/dashboard/optica/medicos/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error'); setSaving(false); return }
      setMedicos(prev => prev.map(m => m.id === editingId ? data : m))
      toast.success('Médico actualizado')
    } else {
      const res = await fetch('/api/dashboard/optica/medicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Error'); setSaving(false); return }
      setMedicos(prev => [...prev, data])
      toast.success('Médico creado')
    }

    cancelForm()
    setSaving(false)
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/dashboard/optica/medicos/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Error al eliminar'); return }
    setMedicos(prev => prev.filter(m => m.id !== id))
    toast.success('Médico eliminado')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Médicos</h1>
          <p className="text-sm text-gray-500">{medicos.length} médico{medicos.length !== 1 ? 's' : ''}</p>
        </div>
        {can('optica.medicos.crear') && (
          <Button className="gap-2" onClick={openNew}>
            <Plus className="w-4 h-4" />
            Nuevo médico
          </Button>
        )}
      </div>

      {/* Filtro */}
      <div className="flex gap-3 px-6 py-3 bg-gray-50 border-b">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre..."
            className="pl-9 h-9"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {/* Formulario inline */}
        {showForm && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
            <h3 className="font-semibold text-sm text-blue-900">{editingId ? 'Editar médico' : 'Nuevo médico'}</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="mb-1 block text-sm">Nombre *</Label>
                <Input
                  placeholder="Dr. Juan García"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  autoFocus
                />
              </div>
              <div>
                <Label className="mb-1 block text-sm">Matrícula</Label>
                <Input
                  placeholder="MP 12345"
                  value={form.matricula}
                  onChange={e => setForm(f => ({ ...f, matricula: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1 block text-sm">Teléfono</Label>
                <Input
                  placeholder="011-1234-5678"
                  value={form.telefono}
                  onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={cancelForm}>
                <X className="w-3.5 h-3.5 mr-1" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Check className="w-3.5 h-3.5 mr-1" />
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </div>
        )}

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : medicos.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium">Sin médicos</p>
            <p className="text-sm mt-1">Agregá médicos para asociarlos a las órdenes de trabajo</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                <th className="pb-2 pr-4 font-medium">Nombre</th>
                <th className="pb-2 pr-4 font-medium">Matrícula</th>
                <th className="pb-2 pr-4 font-medium">Teléfono</th>
                <th className="pb-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {medicos.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="py-3 pr-4 font-medium">{m.nombre}</td>
                  <td className="py-3 pr-4 text-gray-600">{m.matricula ?? '—'}</td>
                  <td className="py-3 pr-4 text-gray-600">{m.telefono ?? '—'}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {can('optica.medicos.editar') && (
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(m)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {can('optica.medicos.eliminar') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-500 hover:bg-red-50"
                          onClick={() => setConfirmDelete(m.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete !== null) handleDelete(confirmDelete); setConfirmDelete(null) }}
        title="Eliminar médico"
        description="¿Querés eliminar este médico? No se eliminarán las órdenes que ya lo referencien."
        confirmLabel="Eliminar"
        variant="destructive"
      />
    </div>
  )
}
