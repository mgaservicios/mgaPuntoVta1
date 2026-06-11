'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Cliente, ClienteTipo } from '@/types/clientes'

export default function ClienteSearch({
  value,
  onChange,
  error,
  required,
}: {
  value: Cliente | null
  onChange: (c: Cliente | null) => void
  error?: boolean
  required?: boolean
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Cliente[]>([])
  const [open, setOpen] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Modal nuevo cliente
  const [modalOpen, setModalOpen] = useState(false)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<ClienteTipo>('PARTICULAR')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [direccion, setDireccion] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [cuit, setCuit] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/dashboard/clientes?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data.slice(0, 8) : [])
    }, 300)
  }, [q])

  function openModal() {
    setNombre(q.trim())
    setTipo('PARTICULAR')
    setTelefono('')
    setEmail('')
    setDireccion('')
    setLocalidad('')
    setCuit('')
    setNotas('')
    setOpen(false)
    setModalOpen(true)
  }

  async function handleCreate() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    setSaving(true)
    const res = await fetch('/api/dashboard/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre.trim(),
        tipo,
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
        direccion: direccion.trim() || undefined,
        localidad: localidad.trim() || undefined,
        cuit: cuit.trim() || undefined,
        notas: notas.trim() || undefined,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error ?? 'Error al crear cliente'); return }
    toast.success(`Cliente "${data.nombre}" creado`)
    setModalOpen(false)
    setQ('')
    setResults([])
    onChange(data)
  }

  if (value) {
    return (
      <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
        <div>
          <p className="text-sm font-medium text-blue-800">{value.nombre}</p>
          {value.telefono && <p className="text-xs text-blue-500">{value.telefono}</p>}
        </div>
        <button onClick={() => onChange(null)} className="text-blue-400 hover:text-blue-600 ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  const hasInvalidText = q.trim() !== '' && !value
  const showError = error || hasInvalidText

  return (
    <>
      <div className="relative">
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${showError ? 'text-red-400' : 'text-gray-400'}`} />
          <Input
            className={`pl-8 pr-8 ${showError ? 'border-red-400 focus-visible:ring-red-300' : ''}`}
            placeholder={required ? 'Buscar cliente… (requerido)' : 'Buscar cliente…'}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          <button
            type="button"
            onClick={openModal}
            title="Nuevo cliente"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {open && (results.length > 0 || q.trim()) && (
          <div className="absolute z-30 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 overflow-hidden">
            {results.map(c => (
              <button
                key={c.id}
                onMouseDown={(e) => { e.preventDefault(); onChange(c); setQ(''); setOpen(false) }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
              >
                <span className="font-medium text-gray-800">{c.nombre}</span>
                {c.telefono && <span className="text-gray-400 text-xs ml-2">{c.telefono}</span>}
              </button>
            ))}
            <button
              onMouseDown={(e) => { e.preventDefault(); openModal() }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm text-blue-600 flex items-center gap-2 border-t border-gray-100"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {results.length === 0 && q.trim()
                ? `Crear cliente "${q.trim()}"`
                : 'Nuevo cliente'}
            </button>
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="mb-1.5 block text-sm">Nombre *</Label>
                <Input
                  placeholder="Nombre completo o razón social"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Tipo</Label>
                <Select value={tipo} onValueChange={(v) => { if (v) setTipo(v as ClienteTipo) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PARTICULAR">Particular</SelectItem>
                    <SelectItem value="EMPRESA">Empresa</SelectItem>
                    <SelectItem value="COMERCIO">Comercio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">
                  {tipo === 'PARTICULAR' ? 'DNI' : 'CUIT'}
                </Label>
                <Input
                  placeholder={tipo === 'PARTICULAR' ? '12345678' : '20-12345678-9'}
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
              <div>
                <Label className="mb-1.5 block text-sm">Email</Label>
                <Input
                  type="email"
                  placeholder="Opcional"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Dirección</Label>
                <Input
                  placeholder="Calle y número"
                  value={direccion}
                  onChange={e => setDireccion(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Localidad</Label>
                <Input
                  placeholder="Ciudad / Localidad"
                  value={localidad}
                  onChange={e => setLocalidad(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Label className="mb-1.5 block text-sm">Notas</Label>
                <textarea
                  rows={2}
                  placeholder="Observaciones internas (opcional)"
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving || !nombre.trim()}>
              {saving ? 'Creando…' : 'Crear cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
