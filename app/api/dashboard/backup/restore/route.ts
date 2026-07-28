import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import * as XLSX from 'xlsx'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SHEETS: { name: string; table: string }[] = [
  { name: 'Parametros',       table: 'parametros' },
  { name: 'Sucursales',       table: 'sucursales' },
  { name: 'Categorias',       table: 'categorias' },
  { name: 'Subcategorias',    table: 'subcategorias' },
  { name: 'Marcas',           table: 'marcas' },
  { name: 'Unidades',         table: 'unidades_medida' },
  { name: 'Proveedores',      table: 'proveedores' },
  { name: 'Atributo Tipos',   table: 'atributo_tipos' },
  { name: 'Listas Precio',    table: 'listas_precio' },
  { name: 'Formas Pago',      table: 'formas_pago' },
  { name: 'FP Cuotas',        table: 'formas_pago_cuotas' },
  { name: 'Vendedores',       table: 'vendedores' },
  { name: 'Optica Medicos',   table: 'optica_medicos' },
  { name: 'Clientes',         table: 'clientes' },
  { name: 'Articulos',        table: 'articulos' },
  { name: 'Variantes',        table: 'articulo_variantes' },
  { name: 'Var Atributos',    table: 'variante_atributos' },
  { name: 'Precios',          table: 'precios' },
  { name: 'Stock',            table: 'articulo_stock' },
  { name: 'Mov Stock',        table: 'movimientos_stock' },
  { name: 'Remitos',          table: 'remitos' },
  { name: 'Remito Items',     table: 'remito_items' },
  { name: 'Caja Sesiones',    table: 'caja_sesiones' },
  { name: 'Caja Movimientos', table: 'caja_movimientos' },
  { name: 'Ventas',           table: 'ventas' },
  { name: 'Venta Items',      table: 'venta_items' },
  { name: 'Venta Pagos',      table: 'venta_pagos' },
  { name: 'Ordenes',          table: 'ordenes_venta' },
  { name: 'Orden Items',      table: 'orden_venta_items' },
  { name: 'Orden Pagos',      table: 'orden_venta_pagos' },
  { name: 'Cobranzas',        table: 'cobranzas' },
  { name: 'Notas Credito',    table: 'notas_credito' },
  { name: 'Optica Ordenes',   table: 'optica_ordenes' },
  { name: 'Optica OT Items',  table: 'optica_orden_items' },
  { name: 'Optica OT Pagos',  table: 'optica_orden_pagos' },
  { name: 'Optica OT Tareas', table: 'optica_orden_tareas' },
  { name: 'Optica Servicios', table: 'optica_servicios' },
  { name: 'Optica Sv Pagos',  table: 'optica_servicio_pagos' },
  { name: 'Optica Sv Tareas', table: 'optica_servicio_tareas' },
]

const BATCH = 500

async function insertBatch(supabase: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return 0
  let total = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const { error } = await supabase.from(table).insert(chunk)
    if (error) {
      console.error(`Error inserting into ${table}:`, error.message)
      throw new Error(`Error insertando en ${table}: ${error.message}`)
    }
    total += chunk.length
  }
  return total
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'Administrador') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const supabase = await getTenantClient(session)

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })

  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    return NextResponse.json({ error: 'El archivo debe ser un Excel (.xlsx o .xls)' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  try {
    const { error: truncErr } = await supabase.rpc('restore_backup_truncate')
    if (truncErr) return NextResponse.json({ error: `Error al limpiar tablas: ${truncErr.message}` }, { status: 500 })
  } catch (e) {
    return NextResponse.json({ error: `Error al ejecutar truncate: ${e instanceof Error ? e.message : 'Error desconocido'}` }, { status: 500 })
  }

  const summary: { table: string; sheet: string; count: number }[] = []
  const errors: { table: string; error: string }[] = []

  for (const { name, table } of SHEETS) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue

    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
    if (json.length === 0) {
      summary.push({ table, sheet: name, count: 0 })
      continue
    }

    const clean = json.map(row => {
      const obj: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(row)) {
        if (v === '' || v === null || v === undefined) {
          obj[k] = null
        } else {
          obj[k] = v
        }
      }
      return obj
    })

    try {
      const count = await insertBatch(supabase, table, clean)
      summary.push({ table, sheet: name, count })
    } catch (e) {
      errors.push({ table, error: e instanceof Error ? e.message : 'Error desconocido' })
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    summary,
    errors,
    totalTables: summary.length,
    totalRows: summary.reduce((a, s) => a + s.count, 0),
  })
}
