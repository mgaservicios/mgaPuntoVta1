'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface Fila {
  nombre: string
  telefono: string
}

interface Props {
  open: boolean
  onClose: () => void
  onImportado: () => void
}

function parsearCSV(texto: string): Fila[] {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim())
  if (lineas.length === 0) return []

  // Detectar separador por la primera línea
  const primera = lineas[0]
  const sep = primera.includes(';') ? ';' : ','

  const filas: Fila[] = []
  for (const linea of lineas) {
    const cols = linea.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))
    const nombre = cols[0] ?? ''
    const telefono = cols[1] ?? ''
    if (!nombre) continue
    filas.push({ nombre, telefono })
  }
  return filas
}

const ENCABEZADOS_CONOCIDOS = ['nombre', 'name', 'cliente', 'telefono', 'phone', 'tel']

function tieneEncabezado(filas: Fila[]): boolean {
  if (filas.length === 0) return false
  const primera = filas[0].nombre.toLowerCase()
  return ENCABEZADOS_CONOCIDOS.some((h) => primera.includes(h))
}

export default function ImportarClientesModal({ open, onClose, onImportado }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [filas, setFilas] = useState<Fila[]>([])
  const [saltarEncabezado, setSaltarEncabezado] = useState(false)
  const [importando, setImportando] = useState(false)
  const [nombreArchivo, setNombreArchivo] = useState('')

  function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setNombreArchivo(archivo.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const texto = ev.target?.result as string
      const parsed = parsearCSV(texto)
      setFilas(parsed)
      setSaltarEncabezado(tieneEncabezado(parsed))
    }
    reader.readAsText(archivo, 'UTF-8')
  }

  const filasFiltradas = saltarEncabezado ? filas.slice(1) : filas

  async function handleImportar() {
    if (filasFiltradas.length === 0) return
    setImportando(true)
    try {
      const res = await fetch('/api/dashboard/clientes/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filasFiltradas),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al importar')
      } else {
        toast.success(`${data.importados} clientes importados`)
        handleCerrar()
        onImportado()
      }
    } finally {
      setImportando(false)
    }
  }

  function handleCerrar() {
    setFilas([])
    setNombreArchivo('')
    setSaltarEncabezado(false)
    if (fileRef.current) fileRef.current.value = ''
    onClose()
  }

  const preview = filasFiltradas.slice(0, 8)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleCerrar()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar clientes desde CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            El archivo debe tener dos columnas: <strong>Nombre</strong> y <strong>Teléfono</strong>.
            Los clientes se importarán como <strong>Particular / Activo</strong>.
          </p>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleArchivo}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              {nombreArchivo || 'Seleccionar archivo CSV'}
            </Button>
          </div>

          {filas.length > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={saltarEncabezado}
                  onChange={(e) => setSaltarEncabezado(e.target.checked)}
                />
                La primera fila es encabezado (omitir)
              </label>

              <p className="text-sm text-gray-500">
                {filasFiltradas.length} cliente{filasFiltradas.length !== 1 ? 's' : ''} a importar
                {filasFiltradas.length > 8 && ` (mostrando primeros 8)`}
              </p>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((f, i) => (
                      <TableRow key={i}>
                        <TableCell>{f.nombre}</TableCell>
                        <TableCell>{f.telefono || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCerrar} disabled={importando}>
            Cancelar
          </Button>
          <Button
            onClick={handleImportar}
            disabled={filasFiltradas.length === 0 || importando}
          >
            {importando ? 'Importando…' : `Importar ${filasFiltradas.length > 0 ? filasFiltradas.length : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
