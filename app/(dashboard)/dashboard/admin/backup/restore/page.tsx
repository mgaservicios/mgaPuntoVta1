'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Upload, AlertTriangle, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

type RestoreSummary = {
  table: string
  sheet: string
  count: number
}

type RestoreError = {
  table: string
  error: string
}

type RestoreResult = {
  ok: boolean
  summary: RestoreSummary[]
  errors: RestoreError[]
  totalTables: number
  totalRows: number
}

export default function RestoreBackupPage() {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RestoreResult | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File | null) {
    if (!f) return
    if (!f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')) {
      toast.error('El archivo debe ser un Excel (.xlsx o .xls)')
      return
    }
    setFile(f)
    setResult(null)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0] ?? null)
  }

  async function handleRestore() {
    if (!file) return
    setConfirmOpen(false)
    setLoading(true)
    setResult(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/dashboard/backup/restore', { method: 'POST', body: fd })
      const data: RestoreResult = await res.json()

      if (!res.ok) {
        toast.error(data.errors?.[0]?.error ?? 'Error al restaurar')
        setLoading(false)
        return
      }

      setResult(data)
      if (data.ok) {
        toast.success(`Backup restaurado: ${data.totalRows} registros en ${data.totalTables} tablas`)
      } else {
        toast.warning(`Restauración parcial: ${data.errors.length} errores`)
      }
    } catch {
      toast.error('Error de red al restaurar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin/backup" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-lg font-semibold text-gray-800">Restaurar backup</h2>
      </div>

      {/* Zona de drop */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0] ?? null)}
        />
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        {file ? (
          <p className="text-sm font-medium text-gray-800">{file.name}</p>
        ) : (
          <p className="text-sm text-gray-500">Arrastrá un archivo Excel o hacé clic para seleccionar</p>
        )}
      </div>

      {/* Advertencia */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div className="text-sm text-red-700">
          <p className="font-semibold">Atención: esta acción es irreversible</p>
          <p className="mt-1">
            Se borrarán TODOS los datos actuales (artículos, ventas, stock, órdenes, etc.)
            y se reemplazarán con los datos del archivo. Los usuarios NO se modifican.
          </p>
        </div>
      </div>

      <Button
        onClick={() => setConfirmOpen(true)}
        disabled={!file || loading}
        variant="destructive"
        className="gap-2"
      >
        <Upload className="w-4 h-4" />
        {loading ? 'Restaurando…' : 'Restaurar backup'}
      </Button>

      {/* Resultado */}
      {result && (
        <div className={`rounded-xl border p-4 ${result.ok ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <p className="text-sm font-semibold mb-2">
            {result.ok ? 'Restauración completada' : 'Restauración con errores'}
          </p>
          <p className="text-xs text-gray-600 mb-3">
            {result.totalRows} registros en {result.totalTables} tablas
          </p>
          <div className="max-h-60 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1 font-medium text-gray-600">Tabla</th>
                  <th className="text-left py-1 font-medium text-gray-600">Hoja</th>
                  <th className="text-right py-1 font-medium text-gray-600">Registros</th>
                </tr>
              </thead>
              <tbody>
                {result.summary.map(s => (
                  <tr key={s.table} className="border-b border-gray-100">
                    <td className="py-1 font-mono">{s.table}</td>
                    <td className="py-1 text-gray-500">{s.sheet}</td>
                    <td className="py-1 text-right">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3 space-y-1">
              {result.errors.map(e => (
                <div key={e.table} className="flex items-start gap-2 text-xs text-red-700">
                  <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span><strong>{e.table}:</strong> {e.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar restauración</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-1">
            Se eliminarán TODOS los datos actuales y se reemplazarán con el contenido de{' '}
            <span className="font-mono font-medium">{file?.name}</span>.
            Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRestore} disabled={loading}>
              {loading ? 'Restaurando…' : 'Sí, restaurar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
