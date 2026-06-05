'use client'

import { useEffect, useState, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import ConfirmDialog from '@/components/dashboard/ConfirmDialog'
import type { ListaPrecio } from '@/types/precios'

type FormState = {
  nombre: string
  tipo: 'manual' | 'calculada'
  categoria: 'costo' | 'venta'
  lista_base_id: string
  porcentaje: string
}

const FORM_INITIAL: FormState = { nombre: '', tipo: 'manual', categoria: 'venta', lista_base_id: '', porcentaje: '' }

export default function ListasPrecioPage() {
  const [listas, setListas] = useState<ListaPrecio[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(FORM_INITIAL)
  const [creando, setCreando] = useState(false)

  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<FormState>(FORM_INITIAL)
  const editRef = useRef<HTMLInputElement>(null)

  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [desactivando, setDesactivando] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/listas-precio')
      .then((r) => r.json())
      .then((d) => { setListas(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  useEffect(() => { if (editId !== null) editRef.current?.focus() }, [editId])

  const listasBase = listas.filter((l) => l.tipo === 'manual' && l.activo)

  async function handleCrear() {
    if (!form.nombre.trim()) return
    if (form.tipo === 'calculada' && !form.lista_base_id) {
      toast.error('Seleccioná una lista base')
      return
    }
    if (form.tipo === 'calculada' && !form.porcentaje.trim()) {
      toast.error('Ingresá el porcentaje')
      return
    }
    setCreando(true)
    const res = await fetch('/api/dashboard/listas-precio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        categoria: form.categoria,
        lista_base_id: form.tipo === 'calculada' ? Number(form.lista_base_id) : null,
        porcentaje: form.tipo === 'calculada' ? Number(form.porcentaje) : null,
        activo: true,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setListas((prev) => [...prev, data])
      setForm(FORM_INITIAL)
      toast.success('Lista creada')
    } else {
      const e = await res.json()
      toast.error(e.error ?? 'Error al crear')
    }
    setCreando(false)
  }

  function startEdit(lista: ListaPrecio) {
    setEditId(lista.id)
    setEditForm({
      nombre: lista.nombre,
      tipo: lista.tipo,
      categoria: lista.categoria,
      lista_base_id: lista.lista_base_id ? String(lista.lista_base_id) : '',
      porcentaje: lista.porcentaje != null ? String(lista.porcentaje) : '',
    })
  }

  async function handleEditar(id: number) {
    if (!editForm.nombre.trim()) { setEditId(null); return }
    const res = await fetch(`/api/dashboard/listas-precio/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: editForm.nombre.trim(),
        tipo: editForm.tipo,
        categoria: editForm.categoria,
        lista_base_id: editForm.tipo === 'calculada' ? Number(editForm.lista_base_id) : null,
        porcentaje: editForm.tipo === 'calculada' ? Number(editForm.porcentaje) : null,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setListas((prev) => prev.map((l) => l.id === id ? data : l))
      toast.success('Lista actualizada')
    } else {
      const e = await res.json()
      toast.error(e.error ?? 'Error al actualizar')
    }
    setEditId(null)
  }

  async function handleDesactivar() {
    if (!confirmId) return
    setDesactivando(true)
    const res = await fetch(`/api/dashboard/listas-precio/${confirmId}`, { method: 'DELETE' })
    if (res.ok) {
      setListas((prev) => prev.map((l) => l.id === confirmId ? { ...l, activo: false } : l))
      toast.success('Lista desactivada')
    } else {
      const e = await res.json()
      toast.error(e.error ?? 'Error al desactivar')
    }
    setDesactivando(false)
    setConfirmId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">Listas de precio</h2>
      </div>

      {/* Formulario de alta */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Nueva lista</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Nombre</label>
            <Input
              placeholder="Ej: Venta Mayorista"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleCrear()}
              className="w-48"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Categoría</label>
            <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v as 'costo' | 'venta' }))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="venta">Venta</SelectItem>
                <SelectItem value="costo">Costo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Tipo</label>
            <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as 'manual' | 'calculada', lista_base_id: '', porcentaje: '' }))}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="calculada">Calculada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.tipo === 'calculada' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">Lista base</label>
                <Select value={form.lista_base_id} onValueChange={(v) => setForm((f) => ({ ...f, lista_base_id: v }))}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Seleccionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {listasBase.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">% ganancia</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej: 30"
                  value={form.porcentaje}
                  onChange={(e) => setForm((f) => ({ ...f, porcentaje: e.target.value }))}
                  className="w-28"
                />
              </div>
            </>
          )}

          <Button onClick={handleCrear} disabled={creando || !form.nombre.trim()} className="self-end">
            <Plus className="w-4 h-4 mr-2" />
            Agregar
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>% Ganancia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">Cargando…</TableCell>
              </TableRow>
            ) : listas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">Sin listas de precio</TableCell>
              </TableRow>
            ) : listas.map((lista) => (
              <TableRow key={lista.id}>
                {/* Nombre */}
                <TableCell>
                  {editId === lista.id ? (
                    <Input
                      ref={editRef}
                      value={editForm.nombre}
                      onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleEditar(lista.id); if (e.key === 'Escape') setEditId(null) }}
                      className="h-8 max-w-[160px]"
                    />
                  ) : (
                    <span className="font-medium">{lista.nombre}</span>
                  )}
                </TableCell>

                {/* Categoría */}
                <TableCell>
                  {editId === lista.id ? (
                    <Select value={editForm.categoria} onValueChange={(v) => setEditForm((f) => ({ ...f, categoria: v as 'costo' | 'venta' }))}>
                      <SelectTrigger className="h-8 w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="venta">Venta</SelectItem>
                        <SelectItem value="costo">Costo</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={lista.categoria === 'costo' ? 'secondary' : 'default'}>
                      {lista.categoria === 'costo' ? 'Costo' : 'Venta'}
                    </Badge>
                  )}
                </TableCell>

                {/* Tipo */}
                <TableCell>
                  {editId === lista.id ? (
                    <Select value={editForm.tipo} onValueChange={(v) => setEditForm((f) => ({ ...f, tipo: v as 'manual' | 'calculada', lista_base_id: '', porcentaje: '' }))}>
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="calculada">Calculada</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={lista.tipo === 'calculada' ? 'secondary' : 'outline'}>
                      {lista.tipo === 'calculada' ? 'Calculada' : 'Manual'}
                    </Badge>
                  )}
                </TableCell>

                {/* Base */}
                <TableCell>
                  {editId === lista.id && editForm.tipo === 'calculada' ? (
                    <Select value={editForm.lista_base_id} onValueChange={(v) => setEditForm((f) => ({ ...f, lista_base_id: v }))}>
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue placeholder="Seleccionar…" />
                      </SelectTrigger>
                      <SelectContent>
                        {listasBase.filter((l) => l.id !== lista.id).map((l) => (
                          <SelectItem key={l.id} value={String(l.id)}>{l.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-gray-600 text-sm">{lista.lista_base?.nombre ?? '—'}</span>
                  )}
                </TableCell>

                {/* Porcentaje */}
                <TableCell>
                  {editId === lista.id && editForm.tipo === 'calculada' ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.porcentaje}
                      onChange={(e) => setEditForm((f) => ({ ...f, porcentaje: e.target.value }))}
                      className="h-8 w-24"
                    />
                  ) : (
                    <span className="text-gray-600 text-sm">
                      {lista.porcentaje != null ? `${lista.porcentaje}%` : '—'}
                    </span>
                  )}
                </TableCell>

                {/* Estado */}
                <TableCell>
                  <Badge variant={lista.activo ? 'default' : 'secondary'}>
                    {lista.activo ? 'Activa' : 'Inactiva'}
                  </Badge>
                </TableCell>

                {/* Acciones */}
                <TableCell>
                  {editId === lista.id ? (
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleEditar(lista.id)}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(lista)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {lista.activo && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => setConfirmId(lista.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={confirmId !== null}
        title="Desactivar lista de precio"
        description="La lista quedará inactiva y no aparecerá en nuevos precios. Las listas calculadas que dependan de ésta también dejarán de funcionar."
        confirmLabel="Desactivar"
        loading={desactivando}
        onConfirm={handleDesactivar}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
