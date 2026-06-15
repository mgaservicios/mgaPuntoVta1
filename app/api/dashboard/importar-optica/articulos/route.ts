import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient } from '@/services/supabase-tenant'
import { requirePermission } from '@/lib/require-permission'

const RUBRO_MAP: Record<string, number> = { ANS: 2, ARM: 3, LCQ: 4 }

export async function POST(req: NextRequest) {
  try {
  const session = await requirePermission('inventario.articulos.crear')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const body = await req.json().catch(() => null)
  const rows = (body as { rows?: { codigo: string; nombre: string; codigoRubro: string; codigoBarra: string }[] } | null)?.rows
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'Sin filas' }, { status: 400 })

  const errors: { codigo: string; error: string }[] = []
  let okCount = 0

  const valid = rows
    .filter(r => r.codigo?.trim() && r.nombre?.trim())
    .map(r => ({
      codigo:      r.codigo.trim(),
      nombre:      r.nombre.trim(),
      marcaNombre: r.nombre.trim().split(/\s+/)[0].toUpperCase(),
      categoria_id: RUBRO_MAP[r.codigoRubro?.trim().toUpperCase()] ?? null,
      codigo_barras: r.codigoBarra?.trim() || null,
    }))

  if (valid.length === 0) return NextResponse.json({ ok: 0, errors })

  // Upsert marcas y construir mapa nombre → id
  const brandNames = [...new Set(valid.map(r => r.marcaNombre))]

  const { error: marcasErr } = await supabase
    .from('marcas')
    .upsert(
      brandNames.map(nombre => ({ nombre, activo: true })),
      { onConflict: 'nombre', ignoreDuplicates: true }
    )
  if (marcasErr) return NextResponse.json({ error: `Error al crear marcas: ${marcasErr.message}` }, { status: 500 })

  const { data: marcasData } = await supabase
    .from('marcas')
    .select('id, nombre')
    .in('nombre', brandNames)

  const marcaMap = Object.fromEntries((marcasData ?? []).map(m => [m.nombre, m.id]))

  const articulos = valid.map(r => ({
    codigo:        r.codigo,
    nombre:        r.nombre,
    tipo_articulo: 'simple' as const,
    categoria_id:  r.categoria_id,
    marca_id:      marcaMap[r.marcaNombre] ?? null,
    proveedor_id:  1,
    unidad_id:     2,
    codigo_barras: r.codigo_barras,
    activo:        true,
  }))

  const BATCH = 100
  for (let i = 0; i < articulos.length; i += BATCH) {
    const batch = articulos.slice(i, i + BATCH)
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
  } catch (err) {
    console.error('[importar-optica/articulos]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
