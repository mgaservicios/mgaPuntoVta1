'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, BookOpen, ChevronRight, Lightbulb, ListChecks, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { AYUDA_MODULOS, buscarEnAyuda, type BusquedaResultado, type AyudaModulo } from '@/lib/ayuda'

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string; active: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   dot: 'bg-blue-500',    active: 'bg-blue-100 border-blue-400 text-blue-800' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',dot: 'bg-emerald-500', active: 'bg-emerald-100 border-emerald-400 text-emerald-800' },
  orange:  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200', dot: 'bg-orange-500',  active: 'bg-orange-100 border-orange-400 text-orange-800' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200', dot: 'bg-violet-500',  active: 'bg-violet-100 border-violet-400 text-violet-800' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  dot: 'bg-amber-500',   active: 'bg-amber-100 border-amber-400 text-amber-800' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200',  dot: 'bg-slate-500',   active: 'bg-slate-100 border-slate-400 text-slate-800' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200', dot: 'bg-indigo-500',  active: 'bg-indigo-100 border-indigo-400 text-indigo-800' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',   dot: 'bg-rose-500',    active: 'bg-rose-100 border-rose-400 text-rose-800' },
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function ResultadoBusqueda({ r, query, onClick }: { r: BusquedaResultado; query: string; onClick: () => void }) {
  const modulo = AYUDA_MODULOS.find(m => m.id === r.moduloId)
  const colors = COLOR_MAP[modulo?.color ?? 'slate']
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0`}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">{modulo?.icono}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
              {r.moduloTitulo}
            </span>
            {r.operacionNombre && (
              <>
                <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700">{r.operacionNombre}</span>
              </>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            {highlightText(r.fragmento, query)}
          </p>
        </div>
      </div>
    </button>
  )
}

function ModuloContent({ modulo, query }: { modulo: AyudaModulo; query: string }) {
  const colors = COLOR_MAP[modulo.color]
  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className={`flex items-center gap-3 mb-2`}>
        <span className="text-3xl">{modulo.icono}</span>
        <h2 className={`text-2xl font-bold ${colors.text}`}>{modulo.titulo}</h2>
      </div>
      <p className="text-gray-600 mb-8 text-sm leading-relaxed border-l-4 pl-4 border-gray-200">
        {modulo.descripcion}
      </p>

      <div className="space-y-8">
        {modulo.operaciones.map((op) => (
          <section key={op.id} id={op.id} className="scroll-mt-4">
            <div className={`rounded-xl border ${colors.border} overflow-hidden`}>
              <div className={`px-5 py-3 ${colors.bg} border-b ${colors.border}`}>
                <h3 className={`font-semibold text-base ${colors.text}`}>
                  {query ? highlightText(op.nombre, query) : op.nombre}
                </h3>
              </div>
              <div className="px-5 py-4 bg-white space-y-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {query ? highlightText(op.descripcion, query) : op.descripcion}
                </p>

                {op.pasos && op.pasos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ListChecks className="w-4 h-4 text-gray-400" />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pasos</span>
                    </div>
                    <ol className="space-y-1.5">
                      {op.pasos.map((paso, i) => (
                        <li key={i} className="flex gap-3 text-sm text-gray-700">
                          <span className={`flex-shrink-0 w-5 h-5 rounded-full ${colors.dot} text-white text-xs flex items-center justify-center font-bold mt-0.5`}>
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">
                            {query ? highlightText(paso, query) : paso}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {op.tips && op.tips.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="w-4 h-4 text-yellow-600" />
                      <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Tips</span>
                    </div>
                    <ul className="space-y-1.5">
                      {op.tips.map((tip, i) => (
                        <li key={i} className="text-sm text-yellow-800 flex gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0" />
                          <span className="leading-relaxed">
                            {query ? highlightText(tip, query) : tip}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default function AyudaPage() {
  const [moduloActivo, setModuloActivo] = useState<string>(AYUDA_MODULOS[0].id)
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<BusquedaResultado[]>([])
  const [busquedaActiva, setBusquedaActiva] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const moduloSeleccionado = AYUDA_MODULOS.find(m => m.id === moduloActivo) ?? AYUDA_MODULOS[0]

  useEffect(() => {
    if (query.trim().length >= 2) {
      setResultados(buscarEnAyuda(query))
      setBusquedaActiva(true)
    } else {
      setResultados([])
      setBusquedaActiva(false)
    }
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setBusquedaActiva(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function irAResultado(r: BusquedaResultado) {
    setQuery('')
    setBusquedaActiva(false)
    setModuloActivo(r.moduloId)
    setTimeout(() => {
      if (r.operacionId && contentRef.current) {
        const el = contentRef.current.querySelector(`#${r.operacionId}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }, 80)
  }

  return (
    <div className="flex flex-col h-full -m-6 lg:-m-8">
      {/* Barra superior de búsqueda */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>

          <div className="flex items-center gap-2 text-gray-700 font-semibold flex-shrink-0">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span>Manual de Ayuda</span>
          </div>

          <div ref={searchRef} className="relative flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => query.trim().length >= 2 && setBusquedaActiva(true)}
                placeholder="Buscar en la ayuda…"
                className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-gray-50"
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); setBusquedaActiva(false); inputRef.current?.focus() }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown de resultados */}
            {busquedaActiva && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
                {resultados.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    No se encontraron resultados para <span className="font-medium text-gray-600">"{query}"</span>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                      <span className="text-xs text-gray-500">{resultados.length} resultado{resultados.length !== 1 ? 's' : ''} para <span className="font-medium text-gray-700">"{query}"</span></span>
                    </div>
                    {resultados.map((r, i) => (
                      <ResultadoBusqueda key={i} r={r} query={query} onClick={() => irAResultado(r)} />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Layout dos paneles */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar de módulos */}
        <nav className="w-52 flex-shrink-0 bg-gray-50 border-r border-gray-200 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">Módulos</p>
            <ul className="space-y-0.5">
              {AYUDA_MODULOS.map(m => {
                const colors = COLOR_MAP[m.color]
                const isActive = m.id === moduloActivo
                return (
                  <li key={m.id}>
                    <button
                      onClick={() => { setModuloActivo(m.id); contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left border ${
                        isActive
                          ? `${colors.active} border`
                          : 'text-gray-600 border-transparent hover:bg-gray-100 hover:text-gray-800'
                      }`}
                    >
                      <span className="text-base leading-none">{m.icono}</span>
                      <span>{m.titulo}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </nav>

        {/* Contenido */}
        <main ref={contentRef} className="flex-1 overflow-y-auto bg-white">
          <ModuloContent modulo={moduloSeleccionado} query={query} />
        </main>
      </div>
    </div>
  )
}
