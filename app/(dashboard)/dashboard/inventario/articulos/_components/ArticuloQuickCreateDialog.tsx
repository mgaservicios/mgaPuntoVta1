'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { Categoria, Marca, UnidadMedida } from '@/types/articulos'
import type { ListaPrecio } from '@/types/precios'

export interface ArticuloCreado {
  id: number
  codigo: string | null
  nombre: string
  tipo_articulo: 'simple' | 'con_variantes'
}

interface Proveedor { id: number; nombre: string }

export default function ArticuloQuickCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (art: ArticuloCreado) => void
}) {
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [subcategoriaId, setSubcategoriaId] = useState('')
  const [marcaId, setMarcaId] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [unidadId, setUnidadId] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [precioCompra, setPrecioCompra] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [saving, setSaving] = useState(false)

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [unidades, setUnidades] = useState<UnidadMedida[]>([])
  const [listas, setListas] = useState<ListaPrecio[]>([])

  useEffect(() => {
    if (!open) return
    fetch('/api/dashboard/articulos/next-code')
      .then(r => r.json())
      .then((d: { codigo?: string }) => setCodigo(d.codigo ?? ''))
      .catch(() => {})
    Promise.all([
      fetch('/api/dashboard/categorias').then(r => r.json()),
      fetch('/api/dashboard/marcas').then(r => r.json()),
      fetch('/api/dashboard/proveedores').then(r => r.json()),
      fetch('/api/dashboard/unidades-medida').then(r => r.json()),
      fetch('/api/dashboard/listas-precio').then(r => r.json()),
    ]).then(([cats, mars, provs, unds, lis]) => {
      setCategorias(Array.isArray(cats) ? cats as Categoria[] : [])
      setMarcas(Array.isArray(mars) ? mars as Marca[] : [])
      setProveedores(Array.isArray(provs) ? provs as Proveedor[] : [])
      setUnidades(Array.isArray(unds) ? unds as UnidadMedida[] : [])
      setListas(Array.isArray(lis) ? lis as ListaPrecio[] : [])
      const unidad = (Array.isArray(unds) ? unds as UnidadMedida[] : [])
        .find(u => u.nombre.toLowerCase() === 'unidad')
      if (unidad) setUnidadId(String(unidad.id))
    })
  }, [open])

  const subcategorias = categorias.find(c => String(c.id) === categoriaId)?.subcategorias ?? []

  async function handleSave() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return }
    if (!codigo.trim()) { toast.error('El código es obligatorio'); return }
    setSaving(true)
    const res = await fetch('/api/dashboard/articulos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre.trim(),
        codigo: codigo.trim(),
        tipo_articulo: 'simple',
        categoria_id: categoriaId ? Number(categoriaId) : null,
        subcategoria_id: subcategoriaId ? Number(subcategoriaId) : null,
        marca_id: marcaId ? Number(marcaId) : null,
        proveedor_id: proveedorId ? Number(proveedorId) : null,
        unidad_id: unidadId ? Number(unidadId) : null,
        codigo_barras: codigoBarras.trim() || undefined,
        precio_compra: precioCompra ? Number(precioCompra) : null,
        precio_venta: precioVenta ? Number(precioVenta) : null,
        activo: true,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      // Registrar el precio en la tabla de precios para que se muestre en el item del remito
      const costoManual = listas.find(l => l.categoria === 'costo' && l.tipo === 'manual' && l.activo)
      const ventaManual = listas.find(l => l.categoria === 'venta' && l.tipo === 'manual' && l.activo)
      const preciosPosts: { lista_precio_id: number; precio: number }[] = []
      if (precioCompra && costoManual) {
        preciosPosts.push({ lista_precio_id: costoManual.id, precio: Number(precioCompra) })
      }
      if (precioVenta && ventaManual) {
        preciosPosts.push({ lista_precio_id: ventaManual.id, precio: Number(precioVenta) })
      }
      if (preciosPosts.length > 0) {
        await Promise.all(
          preciosPosts.map(p =>
            fetch(`/api/dashboard/articulos/${created.id}/precios`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...p, origen_tipo: 'manual' }),
            })
          )
        )
      }
      toast.success(`Artículo "${created.nombre}" creado`)
      onCreated({
        id: created.id,
        codigo: created.codigo ?? null,
        nombre: created.nombre,
        tipo_articulo: 'simple',
      })
      onOpenChange(false)
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al crear el artículo')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo artículo</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-1">
          <div className="col-span-2">
            <Label className="mb-1.5 block text-sm">Nombre *</Label>
            <Input
              placeholder="Nombre del artículo"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !saving && handleSave()}
              autoFocus
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Código *</Label>
            <Input placeholder="ART000" value={codigo} onChange={e => setCodigo(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Unidad</Label>
            <Select value={unidadId || '_none'} onValueChange={v => v !== null && v !== '_none' && setUnidadId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar…" />
              </SelectTrigger>
              <SelectContent>
                {unidades.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Categoría</Label>
            <Select
              value={categoriaId || '_none'}
              onValueChange={v => { if (v === null || v === '_none') return; setCategoriaId(v); setSubcategoriaId('') }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar…" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Subcategoría</Label>
            <Select value={subcategoriaId || '_none'} onValueChange={v => v !== null && v !== '_none' && setSubcategoriaId(v)} disabled={!categoriaId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar…" />
              </SelectTrigger>
              <SelectContent>
                {subcategorias.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Marca</Label>
            <Select value={marcaId || '_none'} onValueChange={v => v !== null && v !== '_none' && setMarcaId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar…" />
              </SelectTrigger>
              <SelectContent>
                {marcas.map(m => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Proveedor</Label>
            <Select value={proveedorId || '_none'} onValueChange={v => v !== null && v !== '_none' && setProveedorId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar…" />
              </SelectTrigger>
              <SelectContent>
                {proveedores.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="mb-1.5 block text-sm">Código de barras</Label>
            <Input
              placeholder="Opcional"
              value={codigoBarras}
              onChange={e => setCodigoBarras(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Precio compra</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={precioCompra}
              onChange={e => setPrecioCompra(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Precio venta</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={precioVenta}
              onChange={e => setPrecioVenta(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !nombre.trim()}>
            {saving ? 'Creando…' : 'Crear y agregar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
