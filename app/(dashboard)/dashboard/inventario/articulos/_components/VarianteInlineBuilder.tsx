'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, X, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { AtributoTipo, AtributoValor, PendingVariante } from '@/types/articulos'

// ─── Combobox con "Guardar en lista" ─────────────────────────────────────────

interface ComboboxProps {
  value: string
  tipoId: number
  onChange: (v: string) => void
  onValorCreado?: (v: AtributoValor) => void
  options: string[]
  placeholder?: string
}

function AtributoCombobox({ value, tipoId, onChange, onValorCreado, options, placeholder = 'Valor…' }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()))

  function select(v: string) {
    onChange(v)
    setQuery(v)
    setOpen(false)
  }

  async function handleBlur() {
    const trimmed = query.trim()
    onChange(trimmed)
    const isNew = trimmed !== '' && !options.some(o => o.toLowerCase() === trimmed.toLowerCase())
    if (isNew) await guardarEnLista(trimmed)
    setTimeout(() => setOpen(false), 150)
  }

  async function guardarEnLista(val?: string) {
    const texto = (val ?? query).trim()
    if (!texto) return
    setSaving(true)
    const res = await fetch('/api/dashboard/atributo-valores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atributo_tipo_id: tipoId, valor: texto }),
    })
    if (res.ok) {
      const created: AtributoValor = await res.json()
      onValorCreado?.(created)
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Error al guardar valor')
    }
    setSaving(false)
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <div className="flex">
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="rounded-r-none border-r-0 h-8 text-sm"
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o) }}
          className="border border-input rounded-r-md px-1.5 bg-background hover:bg-muted transition-colors shrink-0"
        >
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 max-h-44 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-md">
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(opt) }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${opt === value ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-gray-700'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {saving && (
        <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-indigo-400">guardando…</span>
      )}
    </div>
  )
}

// ─── VarianteInlineBuilder ────────────────────────────────────────────────────

export interface VarianteInlineBuilderProps {
  atributoTipos: AtributoTipo[]
  atributoValores: AtributoValor[]
  articuloCodigo: string
  variantes: PendingVariante[]
  onChange: (v: PendingVariante[]) => void
  onValorCreado?: (v: AtributoValor) => void
}

function generarSku(codigo: string, atributos: { atributo_tipo_id: number; valor: string }[]): string {
  const vals = atributos.filter(a => a.valor.trim()).map(a => a.valor.trim().toUpperCase())
  if (vals.length === 0) return codigo
  return [codigo.trim(), ...vals].filter(Boolean).join('-')
}

export default function VarianteInlineBuilder({
  atributoTipos,
  atributoValores,
  articuloCodigo,
  variantes,
  onChange,
  onValorCreado,
}: VarianteInlineBuilderProps) {
  const [tiposActivos, setTiposActivos] = useState<number[]>(() =>
    atributoTipos.length > 0 ? [atributoTipos[0].id] : []
  )

  useEffect(() => {
    if (tiposActivos.length === 0 && atributoTipos.length > 0) {
      setTiposActivos([atributoTipos[0].id])
    }
  }, [atributoTipos]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleTipo(id: number) {
    setTiposActivos(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev
        return prev.filter(x => x !== id)
      }
      return [...prev, id]
    })
  }

  function addVariante() {
    const atributos = tiposActivos.map(tid => ({ atributo_tipo_id: tid, valor: '' }))
    onChange([...variantes, { tempId: crypto.randomUUID(), atributos }])
  }

  function removeVariante(tempId: string) {
    onChange(variantes.filter(v => v.tempId !== tempId))
  }

  function updateAtributo(tempId: string, tipoId: number, valor: string) {
    onChange(variantes.map(v =>
      v.tempId !== tempId ? v : {
        ...v,
        atributos: v.atributos.map(a =>
          a.atributo_tipo_id === tipoId ? { ...a, valor } : a
        ),
      }
    ))
  }

  useEffect(() => {
    if (variantes.length === 0) return
    onChange(variantes.map(v => {
      const existentes = new Map(v.atributos.map(a => [a.atributo_tipo_id, a.valor]))
      return {
        ...v,
        atributos: tiposActivos.map(tid => ({
          atributo_tipo_id: tid,
          valor: existentes.get(tid) ?? '',
        })),
      }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiposActivos])

  const valoresPorTipo = (tipoId: number) =>
    atributoValores
      .filter(av => av.atributo_tipo_id === tipoId)
      .map(av => av.valor)

  return (
    <div className="space-y-3">
      {/* Selector de tipos */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 shrink-0">Atributos:</span>
        {atributoTipos.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => toggleTipo(t.id)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              tiposActivos.includes(t.id)
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            {t.nombre}
          </button>
        ))}
      </div>

      {/* Encabezado de columnas */}
      {variantes.length > 0 && (
        <div className="flex items-center gap-2">
          {tiposActivos.map(tid => {
            const tipo = atributoTipos.find(t => t.id === tid)
            return (
              <span key={tid} className="flex-1 min-w-0 text-xs font-medium text-gray-500 text-center">
                {tipo?.nombre}
              </span>
            )
          })}
          <span className="w-24 shrink-0 text-xs font-medium text-gray-400">SKU</span>
          <span className="w-6 shrink-0" />
        </div>
      )}

      {/* Filas de combinaciones */}
      <div className="space-y-1.5">
        {variantes.map(v => {
          const sku = generarSku(articuloCodigo, v.atributos)
          return (
            <div key={v.tempId} className="flex items-center gap-2">
              {tiposActivos.map(tid => {
                const atrib = v.atributos.find(a => a.atributo_tipo_id === tid)
                return (
                  <AtributoCombobox
                    key={tid}
                    tipoId={tid}
                    value={atrib?.valor ?? ''}
                    onChange={val => updateAtributo(v.tempId, tid, val)}
                    onValorCreado={onValorCreado}
                    options={valoresPorTipo(tid)}
                    placeholder={atributoTipos.find(t => t.id === tid)?.nombre ?? 'Valor'}
                  />
                )
              })}
              <span className="w-24 shrink-0 text-xs text-gray-400 truncate font-mono" title={sku}>
                {sku || '—'}
              </span>
              <button
                type="button"
                onClick={() => removeVariante(v.tempId)}
                className="w-6 shrink-0 text-gray-300 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>

      {/* Botón agregar + contador */}
      <div className="flex items-center gap-3 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={addVariante} className="h-8">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Agregar variante
        </Button>
        {variantes.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {variantes.length} pendiente{variantes.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {variantes.length === 0 && (
        <p className="text-xs text-gray-400">
          Hacé clic en "Agregar variante" para armar combinaciones (ej: Talle M + Color Rojo).
          Si escribís un valor nuevo, se guarda automáticamente en la lista.
        </p>
      )}
    </div>
  )
}
