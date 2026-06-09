'use client'

import { useState, useRef, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Upload, FileText, CheckCircle, XCircle, Package, Tag, BarChart3 } from 'lucide-react'
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
  // Picks the separator that produces the most columns in the header line
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

// Busca una clave por coincidencia exacta primero, luego parcial
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

// Parsea números: strips $, espacios y símbolos; maneja formato argentino y US
function parseNum(s: string): number {
  if (!s) return NaN
  // Quitar todo lo que no sea dígito, punto o coma
  const v = s.trim().replace(/[^0-9.,]/g, '')
  if (!v) return NaN
  const lastComma = v.lastIndexOf(',')
  const lastDot   = v.lastIndexOf('.')
  if (lastComma > lastDot) {
    // "1.500,50" → 1500.50
    return Number(v.replace(/\./g, '').replace(',', '.'))
  }
  // "99000.000" o "1,500.50" → número con punto decimal
  return Number(v.replace(/,/g, ''))
}

const MES_ES: Record<string, string> = {
  ene:'01',feb:'02',mar:'03',abr:'04',may:'05',jun:'06',
  jul:'07',ago:'08',sep:'09',oct:'10',nov:'11',dic:'12',
}

// Parsea fechas en formato "dd-mon-yy" o "dd-mon-yyyy" con mes español
function parseDate(s: string): string {
  if (!s) return new Date().toISOString()
  // Intentar parseo directo primero
  const direct = new Date(s)
  if (!isNaN(direct.getTime())) return direct.toISOString()
  // Formato dd-mon-yy(yy): "19-nov-25", "09-ene-2020"
  const m = s.trim().toLowerCase().match(/^(\d{1,2})[-/]([a-z]{3})[-/](\d{2,4})$/)
  if (m) {
    const day  = m[1].padStart(2, '0')
    const mon  = MES_ES[m[2]] ?? '01'
    const yr   = m[3].length === 2 ? (Number(m[3]) > 50 ? '19' : '20') + m[3] : m[3]
    const iso  = new Date(`${yr}-${mon}-${day}T00:00:00`)
    if (!isNaN(iso.getTime())) return iso.toISOString()
  }
  return new Date().toISOString()
}

// ─── Column mappers ───────────────────────────────────────────────────────────

function mapArticulos(raw: Record<string, string>[]) {
  return raw.map(r => ({
    codigo:      col(r, 'codigo', 'cod', 'codart'),
    nombre:      col(r, 'descripcion', 'nombre', 'desc'),
    codigoRubro: col(r, 'codigorrubro', 'codigorubro', 'rubro', 'categoria', 'cat', 'codrubro'),
    codigoBarra: col(r, 'codigobarra', 'codbarra', 'barcode', 'ean', 'barra'),
  })).filter(r => r.codigo && r.nombre)
}

function mapPrecios(raw: Record<string, string>[]) {
  return raw.map(r => ({
    artCodigo:   col(r, 'artnumcod', 'codigo', 'cod', 'codart'),
    precio:      parseNum(col(r, 'precioventa', 'precio', 'price')),
    fechaPrecio: parseDate(col(r, 'fechaprecio', 'fecha', 'date')),
  })).filter(r => r.artCodigo && r.precio > 0 && !isNaN(r.precio))
}

function mapStock(raw: Record<string, string>[]) {
  return raw.map(r => ({
    artCodigo: col(r, 'artnumcod', 'codigo', 'cod', 'codart'),
    stock:     parseNum(col(r, 'stock', 'cantidad', 'qty')),
  })).filter(r => r.artCodigo && r.stock > 0 && !isNaN(r.stock))
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportResult = { ok: number; errors: { codigo: string; error: string }[]; remitos?: number }
type Status = 'idle' | 'loading' | 'done' | 'error'

// ─── Sub-component per tab ────────────────────────────────────────────────────

function ImportTab<T>({
  title,
  description,
  endpoint,
  mapper,
  previewColumns,
  extraSummary,
}: {
  title: string
  description: string
  endpoint: string
  mapper: (raw: Record<string, string>[]) => T[]
  previewColumns: { label: string; key: keyof T }[]
  extraSummary?: (r: ImportResult) => string
}) {
  const [rows, setRows] = useState<T[]>([])
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
      const mapped = mapper(raw)
      setDetectedHeaders(headers)
      setDetectedSep(sep)
      setRawCount(raw.length)
      setRows(mapped)
      setStatus('idle')
      setResult(null)
      if (rawLines < 2) {
        setParseError(`El archivo tiene ${rawLines} línea(s) — se necesita al menos una de encabezado y una de datos.`)
      } else if (headers.length <= 1) {
        setParseError(`Solo se detectó ${headers.length} columna con separador "${sep}". Verificá que el CSV use , ; | o tabulación.`)
      } else {
        setParseError('')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }, [mapper])

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
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (!res.ok) { setStatus('error'); setResult({ ok: 0, errors: [{ codigo: '', error: data.error ?? 'Error desconocido' }] }); return }
      setResult(data)
      setStatus('done')
    } catch (e) {
      setStatus('error')
      setResult({ ok: 0, errors: [{ codigo: '', error: String(e) }] })
    }
  }

  const preview = rows.slice(0, 8)

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">{description}</p>

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
        <p className="text-xs text-gray-400 mt-1">Soporta separadores , y ; · UTF-8</p>
      </div>

      {/* Diagnóstico del parser */}
      {parseError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{parseError}</div>
      )}
      {detectedHeaders.length > 0 && (
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
              Se leyeron {rawCount} filas pero ninguna pasó la validación. Revisá que las columnas clave no estén vacías y que los números sean válidos.
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
              {rawCount > rows.length && (
                <span className="text-xs text-amber-600 font-normal">({rawCount - rows.length} descartadas)</span>
              )}
            </span>
            <Button variant="outline" size="sm" onClick={() => { setRows([]); setRawCount(0); setDetectedHeaders([]); setDetectedSep(''); setParseError(''); setResult(null); setStatus('idle') }}>
              Limpiar
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {previewColumns.map(c => (
                    <th key={String(c.key)} className="px-3 py-2 text-left font-semibold text-gray-600">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {previewColumns.map(c => (
                      <td key={String(c.key)} className="px-3 py-1.5 text-gray-700 max-w-[200px] truncate">
                        {String((row as Record<string, unknown>)[c.key as string] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 8 && (
              <p className="text-xs text-gray-400 text-center py-2">… y {rows.length - 8} filas más</p>
            )}
          </div>
        </div>
      )}

      <Button
        onClick={handleImport}
        disabled={rows.length === 0 || status === 'loading'}
        className="w-full"
      >
        {status === 'loading' ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Importando…
          </span>
        ) : rows.length > 0
          ? `Importar ${rows.length.toLocaleString()} ${title.toLowerCase()}`
          : `Seleccioná un archivo CSV para importar`
        }
      </Button>

      {/* Result */}
      {result && (
        <div className={cn('rounded-xl border p-4 space-y-3', result.ok > 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50')}>
          <div className="flex items-center gap-2">
            {result.ok > 0
              ? <CheckCircle className="w-5 h-5 text-green-600" />
              : <XCircle className="w-5 h-5 text-red-600" />}
            <span className="font-semibold text-sm">
              {result.ok} importados correctamente
              {result.remitos !== undefined && ` · ${result.remitos} remito(s) generado(s)`}
              {result.errors.length > 0 && ` · ${result.errors.length} error(es)`}
            </span>
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700 font-mono">
                  {e.codigo ? `[${e.codigo}] ` : ''}{e.error}
                </p>
              ))}
            </div>
          )}
          {extraSummary && result.ok > 0 && (
            <p className="text-xs text-gray-500">{extraSummary(result)}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportarOpticaPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importador Óptica</h1>
        <p className="text-sm text-gray-500 mt-1">
          Importá artículos, precios y stock desde archivos CSV. El orden recomendado es: primero Artículos, luego Precios, luego Stock.
        </p>
      </div>

      <Tabs defaultValue="articulos">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="articulos" className="gap-2">
            <Package className="w-4 h-4" /> Artículos
          </TabsTrigger>
          <TabsTrigger value="precios" className="gap-2">
            <Tag className="w-4 h-4" /> Precios
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-2">
            <BarChart3 className="w-4 h-4" /> Stock
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articulos" className="mt-5">
          <ImportTab
            title="Artículos"
            description="Columnas esperadas: Codigo · Descripcion · CodigoRubro (ANS/ARM/LCQ) · codigoBarra. Se crea/actualiza por Codigo."
            endpoint="/api/dashboard/importar-optica/articulos"
            mapper={mapArticulos}
            previewColumns={[
              { label: 'Código', key: 'codigo' as const },
              { label: 'Nombre', key: 'nombre' as const },
              { label: 'Rubro', key: 'codigoRubro' as const },
              { label: 'Cód. Barra', key: 'codigoBarra' as const },
            ]}
          />
        </TabsContent>

        <TabsContent value="precios" className="mt-5">
          <ImportTab
            title="Precios"
            description="Columnas esperadas: ArtNumCod · PrecioVenta · fechaPrecio. Se asignan a la lista de Venta Público (lista #2)."
            endpoint="/api/dashboard/importar-optica/precios"
            mapper={mapPrecios}
            previewColumns={[
              { label: 'Artículo', key: 'artCodigo' as const },
              { label: 'Precio Venta', key: 'precio' as const },
              { label: 'Fecha', key: 'fechaPrecio' as const },
            ]}
          />
        </TabsContent>

        <TabsContent value="stock" className="mt-5">
          <ImportTab
            title="Stock"
            description="Columnas esperadas: ArtNumCod · stock. Se generan Remitos de entrada (hasta 50 ítems c/u) confirmados automáticamente."
            endpoint="/api/dashboard/importar-optica/stock"
            mapper={mapStock}
            previewColumns={[
              { label: 'Artículo', key: 'artCodigo' as const },
              { label: 'Stock', key: 'stock' as const },
            ]}
            extraSummary={r => `Los remitos generados aparecen en Inventario → Remitos como "confirmados".`}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
