import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SHEETS: { name: string; table: string }[] = [
  { name: 'Articulos',        table: 'articulos' },
  { name: 'Variantes',        table: 'articulo_variantes' },
  { name: 'Var Atributos',    table: 'variante_atributos' },
  { name: 'Atributo Tipos',   table: 'atributo_tipos' },
  { name: 'Categorias',       table: 'categorias' },
  { name: 'Subcategorias',    table: 'subcategorias' },
  { name: 'Marcas',           table: 'marcas' },
  { name: 'Unidades',         table: 'unidades_medida' },
  { name: 'Proveedores',      table: 'proveedores' },
  { name: 'Listas Precio',    table: 'listas_precio' },
  { name: 'Precios',          table: 'precios' },
  { name: 'Stock',            table: 'articulo_stock' },
  { name: 'Mov Stock',        table: 'movimientos_stock' },
  { name: 'Ventas',           table: 'ventas' },
  { name: 'Venta Items',      table: 'venta_items' },
  { name: 'Venta Pagos',      table: 'venta_pagos' },
  { name: 'Ordenes',          table: 'ordenes_venta' },
  { name: 'Orden Items',      table: 'orden_venta_items' },
  { name: 'Orden Pagos',      table: 'orden_venta_pagos' },
  { name: 'Caja Sesiones',    table: 'caja_sesiones' },
  { name: 'Caja Movimientos', table: 'caja_movimientos' },
  { name: 'Cobranzas',        table: 'cobranzas' },
  { name: 'Notas Credito',    table: 'notas_credito' },
  { name: 'Remitos',          table: 'remitos' },
  { name: 'Remito Items',     table: 'remito_items' },
  { name: 'Optica Ordenes',   table: 'optica_ordenes' },
  { name: 'Optica OT Items',  table: 'optica_orden_items' },
  { name: 'Optica OT Pagos',  table: 'optica_orden_pagos' },
  { name: 'Optica OT Tareas', table: 'optica_orden_tareas' },
  { name: 'Optica Servicios', table: 'optica_servicios' },
  { name: 'Optica Sv Pagos',  table: 'optica_servicio_pagos' },
  { name: 'Optica Sv Tareas', table: 'optica_servicio_tareas' },
  { name: 'Optica Medicos',   table: 'optica_medicos' },
  { name: 'Sucursales',       table: 'sucursales' },
  { name: 'Formas Pago',      table: 'formas_pago' },
  { name: 'FP Cuotas',        table: 'formas_pago_cuotas' },
  { name: 'Vendedores',       table: 'vendedores' },
  { name: 'Parametros',       table: 'parametros' },
  { name: 'Usuarios',         table: 'users' },
]

async function fetchAll(supabase: SupabaseClient, table: string): Promise<Record<string, unknown>[]> {
  const PAGE = 1000
  const all: Record<string, unknown>[] = []
  let from = 0
  for (let i = 0; i < 100; i++) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    all.push(...(data as Record<string, unknown>[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

export async function GET() {
  const session = await auth()
  if (!session) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  if (session.user.role !== 'Administrador') {
    return new Response(JSON.stringify({ error: 'Acceso denegado' }), { status: 403 })
  }

  const supabase = await getTenantClient(session)

  const results = await Promise.all(
    SHEETS.map(({ table }) => fetchAll(supabase, table))
  )

  const wb = XLSX.utils.book_new()
  SHEETS.forEach(({ name }, i) => {
    const ws = XLSX.utils.json_to_sheet(results[i])
    XLSX.utils.book_append_sheet(wb, ws, name)
  })

  const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array
  const buf = new Uint8Array(raw)
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  return new Response(blob, {
    headers: {
      'Content-Disposition': `attachment; filename="backup-${date}.xlsx"`,
    },
  })
}
