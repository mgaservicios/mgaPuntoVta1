'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { OpticaMedico } from '@/types/optica'

export default function MedicoSearch({
  value,
  onChange,
}: {
  value: OpticaMedico | null
  onChange: (m: OpticaMedico | null) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<OpticaMedico[]>([])
  const [open, setOpen] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/dashboard/optica/medicos?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data.slice(0, 8) : [])
    }, 300)
  }, [q])

  if (value) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-gray-50 text-sm">
        <span className="flex-1 font-medium">{value.nombre}</span>
        {value.matricula && <span className="text-gray-500 text-xs">Mat. {value.matricula}</span>}
        <button onClick={() => onChange(null)} className="text-gray-400 hover:text-gray-600">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <Input
        placeholder="Buscar médico..."
        className="pl-9"
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-md border shadow-lg max-h-60 overflow-auto">
          {results.map(m => (
            <button
              key={m.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
              onMouseDown={() => { onChange(m); setQ(''); setOpen(false) }}
            >
              <span>{m.nombre}</span>
              {m.matricula && <span className="text-gray-400 text-xs">Mat. {m.matricula}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
