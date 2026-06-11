'use client'

import { useState, useRef } from 'react'
import { Search, X, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { Proveedor } from '@/types/proveedores'

export default function ProveedorSearch({
  value,
  onChange,
  error,
  required,
}: {
  value: Proveedor | null
  onChange: (p: Proveedor | null) => void
  error?: boolean
  required?: boolean
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Proveedor[]>([])
  const [open, setOpen] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [modalOpen, setModalOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [cuit, setCuit] = useState('')
  const [telefono, setTelefono] = useState('')
  const [saving, setSaving] = useState(false)

  function search(val: string) {
    setQ(val)
    clearTimeout(debounce.current)
    if (!val.trim()) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/dashboard/proveedores?q=${encodeURIComponent(val)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data.slice(0, 8) : [])
    }, 300)
  }

  function openModal() {
    setNombre(q.trim())
    setCuit('')
    setTelefono('')
    setOpen(false)
    setModalOpen(true)
  }

  async function handleCreate() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    const res = await fetch('/api/dashboard/proveedores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre.trim(),
        cuit: cuit.trim() || undefined,
        telefono: telefono.trim() || undefined,
        activo: true,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error ?? 'Error al crear proveedor'); return }
    toast.success(`Proveedor "${data.nombre}" creado`)
    setModalOpen(false)
    setQ('')
    setResults([])
    onChange(data)
  }

  if (value) {
    return (
      <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex-1 min-w-0">
        <div className="min-w-0">
          <p className="text-sm font-medium text-blue-800 truncate">{value.nombre}</p>
          {value.telefono && <p className="text-xs text-blue-500">{value.telefono}</p>}
        </div>
        <button onClick={() => onChange(null)} className="text-blue-400 hover:text-blue-600 ml-2 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  const hasInvalidText = q.trim() !== '' && !value
  const showError = error || hasInvalidText

  return (
    <>
      <div className="relative flex-1 min-w-0">
        <div className="relative">
          <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${showError ? 'text-red-400' : 'text-gray-400'}`} />
          <Input
            className={`pl-8 pr-8 h-8 text-sm ${showError ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
            placeholder={required ? 'Buscar proveedor… (requerido)' : 'Buscar proveedor…'}
            value={q}
            onChange={(e) => { search(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          <button
            type="button"
            onClick={openModal}
            title="Nuevo proveedor"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
          >
            <Briefcase className="w-3.5 h-3.5" />
          </button>
        </div>

        {open && (results.length > 0 || q.trim()) && (
          <div className="absolute z-30 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 overflow-hidden">
            {results.map(p => (
              <button
                key={p.id}
                onMouseDown={(e) => { e.preventDefault(); onChange(p); setQ(''); setOpen(false) }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
              >
                <span className="font-medium text-gray-800">{p.nombre}</span>
                {p.cuit && <span className="text-gray-400 text-xs ml-2">{p.cuit}</span>}
                {p.telefono && <span className="text-gray-400 text-xs ml-2">{p.telefono}</span>}
              </button>
            ))}
            <button
              onMouseDown={(e) => { e.preventDefault(); openModal() }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm text-blue-600 flex items-center gap-2 border-t border-gray-100"
            >
              <Briefcase className="w-3.5 h-3.5" />
              {results.length === 0 && q.trim()
                ? `Crear proveedor "${q.trim()}"`
                : 'Nuevo proveedor'}
            </button>
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="mb-1.5 block text-sm">Nombre *</Label>
              <Input
                placeholder="Razón social o nombre"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">CUIT</Label>
              <Input
                placeholder="20-12345678-9"
                value={cuit}
                onChange={e => setCuit(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Teléfono</Label>
              <Input
                placeholder="Opcional"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving || !nombre.trim()}>
              {saving ? 'Creando…' : 'Crear proveedor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
