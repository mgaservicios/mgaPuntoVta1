'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

export interface QuickCreateProps {
  open: boolean
  title: string
  apiPath: string
  onClose: () => void
  onCreated: (item: { id: number; nombre: string }) => void
  extraBody?: Record<string, unknown>
}

export default function QuickCreateDialog({
  open, title, apiPath, onClose, onCreated, extraBody,
}: QuickCreateProps) {
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!open) setNombre('') }, [open])

  async function handleSave() {
    if (!nombre.trim()) return
    setSaving(true)
    const res = await fetch(apiPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, ...extraBody }),
    })
    if (res.ok) {
      const created = await res.json()
      toast.success(`${title} creada`)
      onCreated(created)
      onClose()
    } else {
      toast.error(`Error al crear ${title.toLowerCase()}`)
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva {title}</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !saving && handleSave()}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !nombre.trim()}>
            {saving ? 'Creando…' : 'Crear'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
