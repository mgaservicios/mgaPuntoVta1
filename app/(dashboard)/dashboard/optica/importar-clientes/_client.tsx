'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, FileText, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string, sep: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (line.slice(i, i + sep.length) === sep && !inQuote) {
      result.push(cur.trim()); cur = ''; i += sep.length - 1
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

function detectSep(line: string): string {
  const candidates = [';', ',', '\t', '|']
  let best = ','; let bestCount = 0
  for (const s of candidates) {
    const count = parseCSVLine(line, s).length
    if (count > bestCount) { bestCount = count; best = s }
  }
  return best
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[]; sep: string; rawLines: number } {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [], sep: '?', rawLines: lines.length }
  const sep = detectSep(lines[0])
  const headers = parseCSVLine(lines[0], sep).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const rows = lines.slice(1).map(line => {
    const vals = parseCSVLine(line, sep)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
  return { headers, rows, sep, rawLines: lines.length }
}

function col(row: Record<string, string>, ...patterns: string[]): string {
  for (const p of patterns) {
    if (row[p] !== undefined && row[p] !== '') return row[p]
  }
  const keys = Object.keys(row)
  for (const p of patterns) {
    const found = keys.find(k => k.includes(p))
    if (found && row[found] !== undefined) return row[found]
  }
  return ''
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ClienteRow = { nombre: string; telefono: string | null }
type ImportResult = { importados?: number; error?: string }
type Status = 'idle' | 'loading' | 'done' | 'error'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportarClientesClient() {
  const [rows, setRows] = useState<ClienteRow[]>([])
  const [rawCount, setRawCount] = useState(0)
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([])
  const [detectedSep, setDetectedSep] = useState('')
  const [parseError, setParseError] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { headers, rows: raw, sep, rawLines } = parseCSV(text)
      const mapped: ClienteRow[] = raw
        .map(r => ({
          nombre: col(r, 'nombre', 'name').trim(),
          telefono: col(r, 'telefono', 'tel', 'phone', 'celular', 'movil').trim() || null,
        }))
        .filter(r => r.nombre.length > 0)
      setDetectedHeaders(headers)
      setDetectedSep(sep)
      setRawCount(raw.length)
      setRows(mapped)
      setStatus('idle')
      setResult(null)
      if (rawLines < 2) {
        setParseError(`El archivo tiene ${rawLines} línea(s) — necesita al menos encabezado + datos.`)
      } else if (headers.length < 1) {
        setParseError(`No se detectaron columnas con separador "${sep}". Verificá que el CSV use , ; | o tabulación.`)
      } else {
        setParseError('')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleImport = async () => {
    if (rows.length === 0) return
    setStatus('loading')
    try {
      const res = await fetch('/api/dashboard/clientes/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setResult({ error: data.error ?? 'Error desconocido' })
        return
      }
      setResult(data)
      setStatus('done')
    } catch (e) {
      setStatus('error')
      setResult({ error: String(e) })
    }
  }

  const handleClear = () => {
    setRows([])
    setRawCount(0)
    setDetectedHeaders([])
    setDetectedSep('')
    setParseError('')
    setResult(null)
    setStatus('idle')
  }

  const preview = rows.slice(0, 10)
  const sinNombre = rawCount - rows.length

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/optica/ordenes" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-xl font-semibold text-gray-900">Importar clientes desde CSV</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
        <p className="font-semibold">Columnas esperadas:</p>
        <p><strong>nombre</strong> (requerido) · <strong>telefono</strong> (opcional)</p>
        <p>El separador se detecta automáticamente: <code>,</code> <code>;</code> <code>|</code> <code>TAB</code></p>
        <p>Los clientes se insertan como tipo <strong>Particular</strong>.</p>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm font-medium text-gray-600">Arrastrá el CSV aquí o hacé clic para seleccionar</p>
        <p className="text-xs text-gray-400 mt-1">Soporta separadores , · ; · | · TAB · UTF-8</p>
      </div>

      {/* Diagnóstico parser */}
      {parseError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{parseError}</div>
      )}
      {detectedHeaders.length > 0 && !parseError && (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-400">Sep:</span>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">
              {detectedSep === '\t' ? 'TAB' : detectedSep}
            </span>
            <span className="text-xs text-gray-400 ml-2">Columnas:</span>
            {detectedHeaders.map(h => (
              <span key={h} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{h}</span>
            ))}
          </div>
          {rawCount > 0 && rows.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Se leyeron {rawCount} filas pero ninguna pasó la validación — revisá que la columna &quot;nombre&quot; no esté vacía.
            </p>
          )}
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {rows.length.toLocaleString()} filas válidas
              {sinNombre > 0 && (
                <span className="text-xs text-amber-600 font-normal">
                  ({sinNombre} descartadas — sin nombre)
                </span>
              )}
            </span>
            <Button variant="outline" size="sm" onClick={handleClear}>Limpiar</Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Nombre</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">Teléfono</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-1.5 text-gray-700">{row.nombre}</td>
                    <td className="px-3 py-1.5 text-gray-700">{row.telefono ?? '—'}</td>
                  </tr>
                ))}
                {rows.length > 10 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-xs text-gray-400 text-center">
                      … y {rows.length - 10} filas más
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {status !== 'done' && (
            <Button onClick={handleImport} disabled={status === 'loading'} className="w-full sm:w-auto">
              {status === 'loading' ? 'Importando…' : `Importar ${rows.length.toLocaleString()} clientes`}
            </Button>
          )}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className={cn(
          'rounded-lg border px-4 py-3 space-y-2',
          status === 'done' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
        )}>
          <div className="flex items-center gap-2 text-sm font-medium">
            {status === 'done'
              ? <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-800">{result.importados} cliente(s) importado(s) correctamente</span></>
              : <><XCircle className="w-4 h-4 text-red-600" /><span className="text-red-800">Error: {result.error}</span></>
            }
          </div>
          {status === 'done' && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={handleClear}>Importar otro archivo</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
