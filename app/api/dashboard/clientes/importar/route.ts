import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'

interface FilaImport {
  nombre?: string
  telefono?: string
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('ventas.clientes.crear')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const body: FilaImport[] = await req.json()

  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ error: 'Se requiere un array de clientes' }, { status: 400 })
  }

  const rows = body
    .filter((r) => r.nombre?.trim())
    .map((r) => ({
      nombre: r.nombre!.trim(),
      tipo: 'PARTICULAR' as const,
      telefono: r.telefono?.trim() || null,
      activo: true,
    }))

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No hay filas válidas' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('clientes')
    .insert(rows)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ importados: data?.length ?? 0 }, { status: 201 })
}
