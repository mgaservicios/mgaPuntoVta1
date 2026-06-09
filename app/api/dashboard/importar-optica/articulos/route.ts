import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

const RUBRO_MAP: Record<string, number> = { ANS: 2, ARM: 3, LCQ: 4 }
const ROLES_ESCRITURA = ['Administrador', 'Supervisor']

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ROLES_ESCRITURA.includes(session.user.role))
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { rows } = await req.json() as {
    rows: { codigo: string; nombre: string; codigoRubro: string; codigoBarra: string }[]
  }
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'Sin filas' }, { status: 400 })

  const errors: { codigo: string; error: string }[] = []
  let okCount = 0

  const valid = rows
    .filter(r => r.codigo?.trim() && r.nombre?.trim())
    .map(r => ({
      codigo: r.codigo.trim(),
      nombre: r.nombre.trim(),
      tipo_articulo: 'simple' as const,
      categoria_id: RUBRO_MAP[r.codigoRubro?.trim().toUpperCase()] ?? null,
      proveedor_id: 1,
      unidad_id: 1,
      codigo_barras: r.codigoBarra?.trim() || null,
      activo: true,
    }))

  const BATCH = 100
  for (let i = 0; i < valid.length; i += BATCH) {
    const batch = valid.slice(i, i + BATCH)
    const { error } = await supabase
      .from('articulos')
      .upsert(batch, { onConflict: 'codigo', ignoreDuplicates: false })

    if (error) {
      for (const row of batch) {
        const { error: e } = await supabase
          .from('articulos')
          .upsert([row], { onConflict: 'codigo', ignoreDuplicates: false })
        if (e) errors.push({ codigo: row.codigo, error: e.message })
        else okCount++
      }
    } else {
      okCount += batch.length
    }
  }

  return NextResponse.json({ ok: okCount, errors })
}
