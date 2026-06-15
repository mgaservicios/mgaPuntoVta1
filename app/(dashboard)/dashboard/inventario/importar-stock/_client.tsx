'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, FileText, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

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

// ─── Excel parser ─────────────────────────────────────────────────────────────

function parseExcel(buffer: ArrayBuffer): { headers: string[]; rows: Record<string, string>[]; rawLines: number } {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  if (matrix.length < 2) return { headers: [], rows: [], rawLines: 0 }
  const headerRow = matrix[0] as unknown[]
  const dataRows  = matrix.slice(1) as unknown[][]
  const headers = headerRow.map(h => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''))
  const rows = dataRows
    .filter(row => (row as unknown[]).some(cell => String(cell ?? '').trim() !== ''))
    .map(row =>
      Object.fromEntries(headers.map((h, i) => [h, String((row as unknown[])[i] ?? '').trim()]))
    )
  return { headers, rows, rawLines: dataRows.length }
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

function toNum(s: string): number | null {
  if (!s.trim()) return null
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? null : n
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

type StockRow = { codigo: string; stock: number }

function mapStock(raw: Record<string, string>[]): StockRow[] {
  return raw
    .map(r => ({
      codigo: col(r, 'codigo', 'cod', 'codart', 'codarticulo').trim(),
      stock:  toNum(col(r, 'stock', 'cantidad', 'qty', 'cant')) ?? 0,
    }))
    .filter(r => r.codigo !== '' && r.stock > 0)
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportResult = { ok: number; remitos: number; errors: { codigo: string; error: string }[] }
type Status = 'idle' | 'loading' | 'done' | 'error'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportarStockClient() {
  const [rows, setRows]                       = useState<StockRow[]>([])
  const [rawCount, setRawCount]               = useState(0)
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([])
  const [detectedSep, setDetectedSep]         = useState('')
  const [parseError, setParseError]           = useState('')
  const [status, setStatus]                   = useState<Status>('idle')
  const [result, setResult]                   = useState<ImportResult | null>(null)
  const [dragging, setDragging]               = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    const isExcel = /\.(xlsx|xls)$/i.test(file.name)

    const process = (headers: string[], raw: Record<string, string>[], rawLines: number, sep?: string) => {
      const mapped = mapStock(raw)
      setDetectedHeaders(headers)
      setDetectedSep(sep ?? (isExcel ? 'Excel' : '?'))
      setRawCount(raw.length)
      setRows(mapped)
      setStatus('idle')
      setResult(null)
      if (rawLines < 1) {
        setParseError('El archivo está vacío o no tiene datos.')
      } else if (headers.length <= 1) {
        setParseError(`Solo se detectó ${headers.length} columna. Verificá que el archivo tenga encabezados correctos.`)
      } else {
        setParseError('')
      }
    }

    if (isExcel) {
      const reader = new FileReader()
      reader.onload = e => {
        const { headers, rows: raw, rawLines } = parseExcel(e.target?.result as ArrayBuffer)
        process(headers, raw, rawLines)
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = e => {
        const text = e.target?.result as string
        const { headers, rows: raw, sep, rawLines } = parseCSV(text)
        process(headers, raw, rawLines, sep)
      }
      reader.readAsText(file, 'UTF-8')
    }
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
      const res = await fetch('/api/dashboard/importar-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setResult({ ok: 0, remitos: 0, errors: [{ codigo: '', error: data.error ?? 'Error desconocido' }] })
        return
      }
      setResult(data)
      setStatus('done')
    } catch (e) {
      setStatus('error')
      setResult({ ok: 0, remitos: 0, errors: [{ codigo: '', error: String(e) }] })
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

  const preview = rows.slice(0, 8)
  const discarded = rawCount - rows.length

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/inventario/articulos" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-xl font-semibold text-gray-900">Importar stock desde Excel / CSV</h2>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1.5">
        <p className="font-semibold">Columnas requeridas (no distingue mayúsculas ni separadores):</p>
        <div className="flex flex-wrap gap-x-6 gap-y-0.5">
          <span><span className="font-mono bg-blue-100 px-1 rounded">codigo</span> — código del artículo (obligatorio)</span>
          <span><span className="font-mono bg-blue-100 px-1 rounded">stock</span> — cantidad a ingresar (obligatorio, &gt; 0)</span>
        </div>
        <p className="text-blue-600">
          Se generan remitos de entrada confirmados automáticamente (hasta 50 ítems c/u).
          El stock se suma al stock actual de la sucursal.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50',
        )}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />
        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm font-medium text-gray-600">Arrastrá el archivo aquí o hacé clic para seleccionar</p>
        <p className="text-xs text-gray-400 mt-1">Excel (.xlsx, .xls) · CSV (.csv) — separadores , ; | TAB</p>
      </div>

      {parseError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{parseError}</div>
      )}

      {detectedHeaders.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-gray-400">Sep:</span>
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">
            {detectedSep === '\t' ? 'TAB' : detectedSep}
          </span>
          {detectedSep === 'Excel' && <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">xlsx</span>}
          <span className="text-xs text-gray-400 ml-2">Columnas:</span>
          {detectedHeaders.map(h => (
            <span key={h} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{h}</span>
          ))}
        </div>
      )}

      {rawCount > 0 && rows.length === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Se leyeron {rawCount} filas pero ninguna tiene <strong>codigo</strong> y <strong>stock</strong> válidos — revisá las columnas.
        </p>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {rows.length.toLocaleString()} filas válidas
              {discarded > 0 && (
                <span className="text-xs text-amber-600 font-normal">
                  ({discarded} descartadas — sin código o stock inválido)
                </span>
              )}
            </span>
            <Button variant="outline" size="sm" onClick={handleClear}>Limpiar</Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Código</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Stock a ingresar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-700 font-mono">{row.codigo}</td>
                    <td className="px-3 py-1.5 text-gray-700">{row.stock}</td>
                  </tr>
                ))}
                {rows.length > 8 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-xs text-gray-400 text-center">
                      … y {rows.length - 8} filas más
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {status !== 'done' && (
            <Button onClick={handleImport} disabled={status === 'loading'} className="w-full sm:w-auto">
              {status === 'loading'
                ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importando…</span>
                : `Importar ${rows.length.toLocaleString()} artículos`
              }
            </Button>
          )}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className={cn(
          'rounded-lg border px-4 py-3 space-y-2',
          status === 'done' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50',
        )}>
          <div className="flex items-center gap-2 text-sm font-medium">
            {status === 'done'
              ? <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-green-800">{result.ok} artículo(s) importado(s) · {result.remitos} remito(s) generado(s)</span></>
              : <><XCircle className="w-4 h-4 text-red-600" /><span className="text-red-800">Error en la importación</span></>
            }
          </div>
          {result.errors.length > 0 && (
            <ul className="text-xs text-red-700 space-y-0.5 list-disc list-inside max-h-40 overflow-y-auto">
              {result.errors.map((e, i) => (
                <li key={i}>{e.codigo ? `[${e.codigo}] ` : ''}{e.error}</li>
              ))}
            </ul>
          )}
          {status === 'done' && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={handleClear}>Importar otro archivo</Button>
              <Link href="/dashboard/inventario/remitos">
                <Button size="sm">Ver remitos</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
