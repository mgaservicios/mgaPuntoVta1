'use client'

import type { UsoItem } from '@/types/optica'

const USOS: UsoItem[] = ['lejos', 'cerca', 'ambos']

export default function UsoToggle({
  value,
  onChange,
  disabled,
}: {
  value: UsoItem | null
  onChange: (v: UsoItem) => void
  disabled?: boolean
}) {
  return (
    <div className="flex rounded-md border overflow-hidden text-xs">
      {USOS.map(u => (
        <button
          key={u}
          type="button"
          disabled={disabled}
          onClick={() => onChange(u)}
          className={`px-2 py-1.5 flex-1 font-medium transition-colors ${
            value === u
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {u === 'lejos' ? 'Lejos' : u === 'cerca' ? 'Cerca' : 'Ambas'}
        </button>
      ))}
    </div>
  )
}
