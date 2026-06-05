'use client'

import { Trash2, X, Package } from 'lucide-react'
import { Input } from '@/components/ui/input'
import UsoToggle from './UsoToggle'
import ArmazonSearch, { varLabel } from './ArmazonSearch'
import type { TipoOpticaItem, UsoItem } from '@/types/optica'

export interface FormItem {
  key: string
  tipo: TipoOpticaItem
  uso: UsoItem | null
  nombre: string
  armazon_propio: boolean
  articulo_id: number | null
  variante_id: number | null
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  notas: string
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

const TIPO_COLOR: Record<TipoOpticaItem, string> = {
  armazon: 'bg-purple-100 text-purple-700',
  cristal: 'bg-cyan-100 text-cyan-700',
  tratamiento: 'bg-amber-100 text-amber-700',
  otro: 'bg-gray-100 text-gray-600',
}

const TIPO_LABEL: Record<TipoOpticaItem, string> = {
  armazon: 'Armazón',
  cristal: 'Cristal',
  tratamiento: 'Tratamiento',
  otro: 'Otro',
}

export default function ItemRow({
  item,
  onChange,
  onRemove,
  disabled,
  listaId,
}: {
  item: FormItem
  onChange: <K extends keyof FormItem>(field: K, value: FormItem[K]) => void
  onRemove: () => void
  disabled: boolean
  listaId?: number | null
}) {
  const esArmazon = item.tipo === 'armazon'
  const esCristal = item.tipo === 'cristal'
  const subtotal = Math.round(item.cantidad * item.precio_unitario * (1 - item.descuento_pct / 100) * 100) / 100

  return (
    <div className="rounded-lg border bg-white p-3 space-y-2.5">
      {/* Fila 1: etiqueta tipo + uso + nombre */}
      <div className="flex items-center gap-2">
        <span className={`flex-shrink-0 text-xs font-semibold px-2 py-1 rounded ${TIPO_COLOR[item.tipo]}`}>
          {TIPO_LABEL[item.tipo]}
        </span>

        {(esArmazon || esCristal) && (
          <div className="w-44 flex-shrink-0">
            <UsoToggle value={item.uso} onChange={v => onChange('uso', v)} disabled={disabled} />
          </div>
        )}

        <Input
          placeholder={esArmazon ? 'Marca / modelo del armazón' : esCristal ? 'Descripción del cristal' : 'Descripción'}
          className="flex-1 h-8 text-sm"
          value={item.nombre}
          onChange={e => onChange('nombre', e.target.value)}
          disabled={disabled}
        />

        {!disabled && (
          <button onClick={onRemove} className="text-gray-400 hover:text-red-500 flex-shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Fila 2: búsqueda stock (armazón) + precio / cantidad / descuento */}
      <div className="flex items-center gap-2 flex-wrap">
        {esArmazon && !disabled && (
          <>
            {!item.armazon_propio && (
              <div className="w-52">
                <ArmazonSearch
                  listaId={listaId}
                  onSelect={(a, v) => {
                    onChange('nombre', a.nombre + (v ? ' – ' + varLabel(v) : ''))
                    onChange('articulo_id', a.id)
                    onChange('variante_id', v?.id ?? null)
                    onChange('precio_unitario', v?.precio_venta ?? a.precio_venta ?? 0)
                  }}
                />
              </div>
            )}
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={item.armazon_propio}
                onChange={e => onChange('armazon_propio', e.target.checked)}
              />
              Propio del cliente
            </label>
          </>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Cant.</span>
            <Input
              type="number"
              className="h-8 w-16 text-sm text-center"
              value={item.cantidad}
              onChange={e => onChange('cantidad', parseFloat(e.target.value) || 1)}
              disabled={disabled}
              min="0"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Precio</span>
            <Input
              type="number"
              className="h-8 w-28 text-sm text-right"
              value={item.precio_unitario}
              onChange={e => onChange('precio_unitario', parseFloat(e.target.value) || 0)}
              disabled={disabled || (esArmazon && item.armazon_propio)}
              min="0"
              placeholder="0.00"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Desc%</span>
            <Input
              type="number"
              className="h-8 w-16 text-sm text-center"
              value={item.descuento_pct}
              onChange={e => onChange('descuento_pct', parseFloat(e.target.value) || 0)}
              disabled={disabled || (esArmazon && item.armazon_propio)}
              min="0" max="100"
            />
          </div>
          <span className="text-sm font-medium text-gray-700 w-24 text-right">
            {esArmazon && item.armazon_propio
              ? <span className="text-xs text-gray-400">sin costo</span>
              : formatARS(subtotal)}
          </span>
        </div>
      </div>

      {/* Artículo de stock vinculado */}
      {esArmazon && item.articulo_id && !disabled && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Package className="w-3 h-3" />
          Artículo de stock vinculado (id {item.articulo_id})
          <button
            className="ml-1 text-gray-400 hover:text-red-500"
            onClick={() => { onChange('articulo_id', null); onChange('variante_id', null) }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}
