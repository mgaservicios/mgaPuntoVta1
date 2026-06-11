import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/services/supabase-tenant'
import { requirePermission } from '@/lib/require-permission'

type ProveedorRow = {
  id: number | null
  nombre: string
  contacto: string | null
  cuit: string | null
  telefono: string | null
  direccion: string | null
  localidad: string | null
  provincia: string | null
  cod_postal: string | null
  tipo_iva: string | null
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('inventario.proveedores.crear')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const body = await req.json()
  const rows: ProveedorRow[] = body.rows ?? []

  if (rows.length === 0) return NextResponse.json({ error: 'Sin filas' }, { status: 400 })

  const conId = rows.filter(r => r.id && r.id > 0)
  const sinId = rows.filter(r => !r.id || r.id <= 0).map(({ id: _id, ...rest }) => rest)

  let ok = 0
  const errors: { id: string; nombre: string; error: string }[] = []

  // Upsert filas con id (actualiza si existe, inserta si no)
  const BATCH = 100
  for (let i = 0; i < conId.length; i += BATCH) {
    const batch = conId.slice(i, i + BATCH)
    const { error } = await supabase
      .from('proveedores')
      .upsert(batch, { onConflict: 'id' })
    if (error) {
      for (const row of batch) {
        const { error: e2 } = await supabase.from('proveedores').upsert(row, { onConflict: 'id' })
        if (e2) errors.push({ id: String(row.id), nombre: row.nombre, error: e2.message })
        else ok++
      }
    } else {
      ok += batch.length
    }
  }

  // Insert filas sin id
  for (let i = 0; i < sinId.length; i += BATCH) {
    const batch = sinId.slice(i, i + BATCH)
    const { error } = await supabase.from('proveedores').insert(batch)
    if (error) {
      for (const row of batch) {
        const { error: e2 } = await supabase.from('proveedores').insert(row)
        if (e2) errors.push({ id: '—', nombre: row.nombre, error: e2.message })
        else ok++
      }
    } else {
      ok += batch.length
    }
  }

  return NextResponse.json({ ok, errors })
}
