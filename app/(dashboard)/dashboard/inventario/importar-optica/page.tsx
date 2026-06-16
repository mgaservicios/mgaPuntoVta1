'use client'

import { useState, useRef, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Upload, FileText, CheckCircle, XCircle, Package, Tag, BarChart3, ChevronDown, ChevronUp, Info, Truck } from 'lucide-react'
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
  return raw.map(r => {
    const nombre = col(r, 'descripcion', 'nombre', 'desc')
    return {
      codigo:      col(r, 'codigo', 'cod', 'codart'),
      nombre,
      marca:       nombre.trim().split(/\s+/)[0]?.toUpperCase() ?? '',
      codigoRubro: col(r, 'codigorrubro', 'codigorubro', 'rubro', 'categoria', 'cat', 'codrubro'),
      codigoBarra: col(r, 'codigobarra', 'codbarra', 'barcode', 'ean', 'barra'),
      proNum:      col(r, 'pronum', 'proveedornum', 'codproveedor', 'proveedor'),
    }
  }).filter(r => r.codigo && r.nombre)
}

function diagnoseArticulos(raw: Record<string, string>[]): string | null {
  let sinCodigo = 0, sinNombre = 0, ambos = 0
  for (const r of raw) {
    const codigo = col(r, 'codigo', 'cod', 'codart')
    const nombre = col(r, 'descripcion', 'nombre', 'desc')
    if (!codigo && !nombre) { ambos++; continue }
    if (!codigo) sinCodigo++
    if (!nombre) sinNombre++
  }
  const partes: string[] = []
  if (sinCodigo > 0) partes.push(`${sinCodigo} sin código`)
  if (sinNombre > 0) partes.push(`${sinNombre} sin descripción`)
  if (ambos > 0) partes.push(`${ambos} sin código ni descripción`)
  return partes.length > 0 ? `Descartadas: ${partes.join(' · ')}` : null
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
    proNum:    col(r, 'pronum', 'proveedornum', 'codproveedor', 'proveedor'),
  })).filter(r => r.artCodigo && r.stock > 0 && !isNaN(r.stock))
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportResult = { ok: number; errors: { codigo: string; error: string }[]; remitos?: number }
type Status = 'idle' | 'loading' | 'done' | 'error'

// ─── Proveedores mapper ───────────────────────────────────────────────────────

const TIPO_IVA_MAP: Record<string, string> = {
  I: 'Responsable Inscripto', N: 'No Inscripto', M: 'Monotributista', E: 'Exento',
}

type ProveedorMapped = {
  id: number | null; nombre: string; contacto: string | null; cuit: string | null
  telefono: string | null; direccion: string | null; localidad: string | null
  provincia: string | null; cod_postal: string | null; tipo_iva: string | null
}

function mapProveedores(raw: Record<string, string>[]): ProveedorMapped[] {
  return raw.map(r => {
    const idRaw = col(r, 'pronum'); const idNum = idRaw ? parseInt(idRaw, 10) : null
    const tivaRaw = col(r, 'protipiiva', 'protipoiva', 'tipiva').trim().toUpperCase()
    return {
      id: idNum && !isNaN(idNum) && idNum > 0 ? idNum : null,
      nombre: col(r, 'pronom').trim(),
      contacto: col(r, 'pronomcon') || null, cuit: col(r, 'procui') || null,
      telefono: col(r, 'protel') || null, direccion: col(r, 'prodom') || null,
      localidad: col(r, 'proloc') || null, provincia: col(r, 'proprov') || null,
      cod_postal: col(r, 'procodpos') || null,
      tipo_iva: TIPO_IVA_MAP[tivaRaw] ?? (tivaRaw || null),
    }
  }).filter(r => r.nombre.length > 0)
}

const PROV_PREVIEW_COLS: { label: string; key: keyof ProveedorMapped }[] = [
  { label: 'ID', key: 'id' }, { label: 'Nombre', key: 'nombre' },
  { label: 'Contacto', key: 'contacto' }, { label: 'CUIT', key: 'cuit' },
  { label: 'Domicilio', key: 'direccion' }, { label: 'Localidad', key: 'localidad' },
  { label: 'Provincia', key: 'provincia' }, { label: 'Teléfono', key: 'telefono' },
  { label: 'Tipo IVA', key: 'tipo_iva' },
]

// ─── ProveedoresTab ───────────────────────────────────────────────────────────

function ProveedoresTab() {
  const [showManual, setShowManual] = useState(false)
  const [rows, setRows] = useState<ProveedorMapped[]>([])
  const [rawCount, setRawCount] = useState(0)
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([])
  const [detectedSep, setDetectedSep] = useState('')
  const [parseError, setParseError] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<{ ok: number; errors: { id: string; nombre: string; error: string }[] } | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { headers, rows: raw, sep, rawLines } = parseCSV(text)
      const mapped = mapProveedores(raw)
      setDetectedHeaders(headers); setDetectedSep(sep); setRawCount(raw.length)
      setRawRows(raw); setRows(mapped); setStatus('idle'); setResult(null)
      if (rawLines < 2) setParseError(`El archivo tiene ${rawLines} línea(s) — necesita al menos encabezado + datos.`)
      else if (headers.length <= 1) setParseError(`Solo se detectó ${headers.length} columna con separador "${sep}".`)
      else setParseError('')
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const handleImport = async () => {
    if (rows.length === 0) return
    setStatus('loading')
    try {
      const res = await fetch('/api/dashboard/importar-proveedores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const text = await res.text()
      let data: typeof result & { error?: string }
      try { data = JSON.parse(text) } catch {
        setStatus('error')
        setResult({ ok: 0, errors: [{ id: '', nombre: '', error: `Respuesta inesperada: ${text.slice(0, 200)}` }] })
        return
      }
      if (!res.ok) { setStatus('error'); setResult({ ok: 0, errors: [{ id: '', nombre: '', error: data?.error ?? 'Error' }] }); return }
      setResult(data); setStatus('done')
    } catch (e) {
      setStatus('error'); setResult({ ok: 0, errors: [{ id: '', nombre: '', error: String(e) }] })
    }
  }

  const handleClear = () => {
    setRows([]); setRawCount(0); setRawRows([]); setDetectedHeaders([])
    setDetectedSep(''); setParseError(''); setResult(null); setStatus('idle')
  }

  const sinNombre = rawRows.filter(r => !col(r, 'pronom').trim()).length
  const discardDiag = rawRows.length > 0 && sinNombre > 0 ? `${sinNombre} sin nombre` : null
  const preview = rows.slice(0, 8)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-500">Importa o actualiza proveedores desde CSV. Si ProNum coincide con un ID existente, lo actualiza; si no, lo crea.</p>
        <button onClick={() => setShowManual(v => !v)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 shrink-0 font-medium">
          <Info className="w-3.5 h-3.5" />
          {showManual ? 'Ocultar manual' : 'Ver manual'}
          {showManual ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {showManual && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs space-y-3">
          <div>
            <p className="font-semibold text-blue-800 mb-1.5">Columnas del CSV</p>
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-blue-100 text-blue-900"><th className="text-left px-2 py-1 rounded-l">Columna</th><th className="text-left px-2 py-1">Req.</th><th className="text-left px-2 py-1 rounded-r">Descripción</th></tr></thead>
              <tbody className="divide-y divide-blue-100">
                <tr><td className="px-2 py-1 font-mono">ProNum</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600">ID del proveedor. Si coincide con uno existente, lo actualiza.</td></tr>
                <tr><td className="px-2 py-1 font-mono">ProNom</td><td className="px-2 py-1 text-green-700">Sí</td><td className="px-2 py-1 text-gray-600">Nombre del proveedor.</td></tr>
                <tr><td className="px-2 py-1 font-mono">ProNomCon</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600">Nombre del contacto.</td></tr>
                <tr><td className="px-2 py-1 font-mono">ProCui</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600">CUIT.</td></tr>
                <tr><td className="px-2 py-1 font-mono">ProTel</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600">Teléfono.</td></tr>
                <tr><td className="px-2 py-1 font-mono">ProDom</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600">Domicilio.</td></tr>
                <tr><td className="px-2 py-1 font-mono">ProLoc</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600">Localidad.</td></tr>
                <tr><td className="px-2 py-1 font-mono">ProProv</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600">Provincia.</td></tr>
                <tr><td className="px-2 py-1 font-mono">ProCodPos</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600">Código postal.</td></tr>
                <tr><td className="px-2 py-1 font-mono">ProTipIva</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600"><span className="font-mono">I</span> Resp. Inscripto · <span className="font-mono">M</span> Monotributista · <span className="font-mono">N</span> No Inscripto · <span className="font-mono">E</span> Exento</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div
        className={cn('border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50')}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm font-medium text-gray-600">Arrastrá el CSV aquí o hacé clic para seleccionar</p>
        <p className="text-xs text-gray-400 mt-1">Soporta separadores , ; | · UTF-8</p>
      </div>

      {parseError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{parseError}</div>}
      {detectedHeaders.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-gray-400">Sep:</span>
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">{detectedSep === '\t' ? 'TAB' : detectedSep}</span>
          <span className="text-xs text-gray-400 ml-2">Columnas:</span>
          {detectedHeaders.map(h => <span key={h} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{h}</span>)}
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {rows.length.toLocaleString()} filas válidas
              {rawCount > rows.length && (
                <span className="text-xs text-amber-600 font-normal">({rawCount - rows.length} descartadas{discardDiag ? ` — ${discardDiag}` : ''})</span>
              )}
            </span>
            <Button variant="outline" size="sm" onClick={handleClear}>Limpiar</Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{PROV_PREVIEW_COLS.map(c => <th key={c.key} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{c.label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {PROV_PREVIEW_COLS.map(c => <td key={c.key} className="px-3 py-1.5 text-gray-700 max-w-[160px] truncate">{String(row[c.key] ?? '—')}</td>)}
                  </tr>
                ))}
                {rows.length > 8 && <tr><td colSpan={PROV_PREVIEW_COLS.length} className="px-3 py-2 text-xs text-gray-400 text-center">… y {rows.length - 8} filas más</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Button onClick={handleImport} disabled={rows.length === 0 || status === 'loading'} className="w-full">
        {status === 'loading'
          ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importando…</span>
          : rows.length > 0 ? `Importar ${rows.length.toLocaleString()} proveedores` : 'Seleccioná un archivo CSV para importar'}
      </Button>

      {result && (
        <div className={cn('rounded-xl border p-4 space-y-3', result.ok > 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50')}>
          <div className="flex items-center gap-2">
            {result.ok > 0 ? <CheckCircle className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
            <span className="font-semibold text-sm">{result.ok} proveedor(es) importado(s){result.errors.length > 0 ? ` · ${result.errors.length} error(es)` : ''}</span>
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700 font-mono">{e.nombre || e.id ? `[${e.id || '—'} ${e.nombre}] ` : ''}{e.error}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-component per tab ────────────────────────────────────────────────────

function ImportTab<T>({
  title,
  description,
  endpoint,
  mapper,
  previewColumns,
  extraSummary,
  diagnoseDiscards,
  manual,
}: {
  title: string
  description: string
  endpoint: string
  mapper: (raw: Record<string, string>[]) => T[]
  previewColumns: { label: string; key: keyof T }[]
  extraSummary?: (r: ImportResult) => string
  diagnoseDiscards?: (raw: Record<string, string>[]) => string | null
  manual?: React.ReactNode
}) {
  const [showManual, setShowManual] = useState(false)
  const [rows, setRows] = useState<T[]>([])
  const [rawCount, setRawCount] = useState(0)
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
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
      setRawRows(raw)
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
      const text = await res.text()
      let data: ImportResult & { error?: string }
      try { data = JSON.parse(text) } catch { setStatus('error'); setResult({ ok: 0, errors: [{ codigo: '', error: `Respuesta inesperada del servidor: ${text.slice(0, 200)}` }] }); return }
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
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-500">{description}</p>
        {manual && (
          <button
            onClick={() => setShowManual(v => !v)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 shrink-0 font-medium"
          >
            <Info className="w-3.5 h-3.5" />
            {showManual ? 'Ocultar manual' : 'Ver manual'}
            {showManual ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>
      {manual && showManual && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs space-y-3">
          {manual}
        </div>
      )}

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
                <span className="text-xs text-amber-600 font-normal">
                  ({rawCount - rows.length} descartadas
                  {diagnoseDiscards ? ` — ${diagnoseDiscards(rawRows)}` : ''})
                </span>
              )}
            </span>
            <Button variant="outline" size="sm" onClick={() => { setRows([]); setRawCount(0); setRawRows([]); setDetectedHeaders([]); setDetectedSep(''); setParseError(''); setResult(null); setStatus('idle') }}>
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
          Importá datos desde archivos CSV. Orden recomendado: primero Proveedores, luego Artículos, luego Precios, luego Stock.
        </p>
      </div>

      <Tabs defaultValue="proveedores">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="proveedores" className="gap-2">
            <Truck className="w-4 h-4" /> Proveedores
          </TabsTrigger>
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

        <TabsContent value="proveedores" className="mt-5">
          <ProveedoresTab />
        </TabsContent>

        <TabsContent value="articulos" className="mt-5">
          <ImportTab
            title="Artículos"
            description="Importa o actualiza artículos desde el sistema óptica. Upsert por Codigo — si ya existe lo actualiza, si no lo crea."
            endpoint="/api/dashboard/importar-optica/articulos"
            mapper={mapArticulos}
            diagnoseDiscards={diagnoseArticulos}
            previewColumns={[
              { label: 'Código', key: 'codigo' as const },
              { label: 'Nombre', key: 'nombre' as const },
              { label: 'Marca', key: 'marca' as const },
              { label: 'Rubro', key: 'codigoRubro' as const },
              { label: 'Cód. Barra', key: 'codigoBarra' as const },
              { label: 'Proveedor', key: 'proNum' as const },
            ]}
            manual={
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-blue-800 mb-1.5">Columnas del CSV</p>
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="bg-blue-100 text-blue-900"><th className="text-left px-2 py-1 rounded-l">Columna</th><th className="text-left px-2 py-1">Requerida</th><th className="text-left px-2 py-1 rounded-r">Descripción</th></tr></thead>
                    <tbody className="divide-y divide-blue-100">
                      <tr><td className="px-2 py-1 font-mono">Codigo</td><td className="px-2 py-1 text-green-700">Sí</td><td className="px-2 py-1 text-gray-600">Código único del artículo. Clave de upsert.</td></tr>
                      <tr><td className="px-2 py-1 font-mono">Descripcion</td><td className="px-2 py-1 text-green-700">Sí</td><td className="px-2 py-1 text-gray-600">Nombre del artículo. La primera palabra se usa como marca.</td></tr>
                      <tr><td className="px-2 py-1 font-mono">CodigoRubro</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600">Categoría: <span className="font-mono">ANS</span> · <span className="font-mono">ARM</span> · <span className="font-mono">LCQ</span></td></tr>
                      <tr><td className="px-2 py-1 font-mono">codigoBarra</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600">Código de barras (EAN/UPC). Debe ser único en toda la tabla.</td></tr>
                      <tr><td className="px-2 py-1 font-mono">ProNum</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600">Código numérico del proveedor. Se guarda como <span className="font-mono">proveedor_id</span>.</td></tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="font-semibold text-blue-800 mb-1">Comportamiento</p>
                  <ul className="space-y-0.5 text-gray-700 list-disc list-inside">
                    <li>Si el artículo ya existe (mismo <span className="font-mono">Codigo</span>), se actualizan todos los campos.</li>
                    <li>La marca se crea automáticamente si no existe.</li>
                    <li>Filas sin <span className="font-mono">Codigo</span> o sin <span className="font-mono">Descripcion</span> se descartan.</li>
                    <li>Se procesa en lotes de 500 — errores aíslan el artículo por bisección.</li>
                  </ul>
                </div>
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="precios" className="mt-5">
          <ImportTab
            title="Precios"
            description="Importa precios de venta y los asigna a la lista Venta Público (lista #2). Se registra historial de precios por vigencia."
            endpoint="/api/dashboard/importar-optica/precios"
            mapper={mapPrecios}
            previewColumns={[
              { label: 'Artículo', key: 'artCodigo' as const },
              { label: 'Precio Venta', key: 'precio' as const },
              { label: 'Fecha', key: 'fechaPrecio' as const },
            ]}
            manual={
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-blue-800 mb-1.5">Columnas del CSV</p>
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="bg-blue-100 text-blue-900"><th className="text-left px-2 py-1 rounded-l">Columna</th><th className="text-left px-2 py-1">Requerida</th><th className="text-left px-2 py-1 rounded-r">Descripción</th></tr></thead>
                    <tbody className="divide-y divide-blue-100">
                      <tr><td className="px-2 py-1 font-mono">ArtNumCod</td><td className="px-2 py-1 text-green-700">Sí</td><td className="px-2 py-1 text-gray-600">Código del artículo (debe existir previamente en la tabla).</td></tr>
                      <tr><td className="px-2 py-1 font-mono">PrecioVenta</td><td className="px-2 py-1 text-green-700">Sí</td><td className="px-2 py-1 text-gray-600">Precio de venta. Acepta formato argentino con <span className="font-mono">.</span> de miles y <span className="font-mono">,</span> decimal.</td></tr>
                      <tr><td className="px-2 py-1 font-mono">fechaPrecio</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600">Fecha de vigencia. Formatos: <span className="font-mono">dd-mon-aa</span> (ej. 19-nov-25) · ISO · vacío = hoy.</td></tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="font-semibold text-blue-800 mb-1">Comportamiento</p>
                  <ul className="space-y-0.5 text-gray-700 list-disc list-inside">
                    <li>Los precios se registran en la <strong>Lista #2 — Venta Público</strong>.</li>
                    <li>Se guarda historial: se puede reimportar con distintas fechas sin perder registros anteriores.</li>
                    <li>Artículos no encontrados se reportan como error (no se descartan silenciosamente).</li>
                    <li>Filas con precio 0 o negativo se descartan.</li>
                  </ul>
                </div>
              </div>
            }
          />
        </TabsContent>

        <TabsContent value="stock" className="mt-5">
          <ImportTab
            title="Stock"
            description="Genera remitos de entrada confirmados. El stock se agrupa por proveedor y se SUMA al existente (no reemplaza)."
            endpoint="/api/dashboard/importar-optica/stock"
            mapper={mapStock}
            previewColumns={[
              { label: 'Artículo', key: 'artCodigo' as const },
              { label: 'Stock', key: 'stock' as const },
              { label: 'Proveedor', key: 'proNum' as const },
            ]}
            manual={
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-blue-800 mb-1.5">Columnas del CSV</p>
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="bg-blue-100 text-blue-900"><th className="text-left px-2 py-1 rounded-l">Columna</th><th className="text-left px-2 py-1">Requerida</th><th className="text-left px-2 py-1 rounded-r">Descripción</th></tr></thead>
                    <tbody className="divide-y divide-blue-100">
                      <tr><td className="px-2 py-1 font-mono">ArtNumCod</td><td className="px-2 py-1 text-green-700">Sí</td><td className="px-2 py-1 text-gray-600">Código del artículo (debe existir en la tabla).</td></tr>
                      <tr><td className="px-2 py-1 font-mono">stock</td><td className="px-2 py-1 text-green-700">Sí</td><td className="px-2 py-1 text-gray-600">Cantidad a ingresar. Debe ser mayor a 0.</td></tr>
                      <tr><td className="px-2 py-1 font-mono">ProNum</td><td className="px-2 py-1 text-gray-400">No</td><td className="px-2 py-1 text-gray-600">Código del proveedor. Cada proveedor genera su propio grupo de remitos.</td></tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="font-semibold text-blue-800 mb-1">Comportamiento</p>
                  <ul className="space-y-0.5 text-gray-700 list-disc list-inside">
                    <li>Los ítems se agrupan por <span className="font-mono">ProNum</span>. Cada grupo genera remitos de hasta 50 ítems.</li>
                    <li>Los remitos se crean como <strong>Entrada · confirmados</strong> y aparecen en Inventario → Remitos.</li>
                    <li>El stock se <strong>suma</strong> al existente — no reemplaza. Reimportar duplica el stock.</li>
                    <li>Artículos no encontrados se reportan como error y se omiten.</li>
                  </ul>
                </div>
                <div className="rounded bg-amber-100 border border-amber-300 px-3 py-2 text-amber-800">
                  <strong>Atención:</strong> esta importación es para stock inicial. Si ya importaste, no reimportar sin verificar el stock actual.
                </div>
              </div>
            }
            extraSummary={r => `Los remitos generados aparecen en Inventario → Remitos como "confirmados".`}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
