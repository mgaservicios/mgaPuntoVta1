import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const tipoId = req.nextUrl.searchParams.get('tipo_id')

  let query = supabase
    .from('atributo_valores')
    .select('id, atributo_tipo_id, valor, activo, orden')
    .eq('activo', true)
    .order('orden')
    .order('valor')

  if (tipoId) query = query.eq('atributo_tipo_id', Number(tipoId))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('altas.atributos.crear')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { atributo_tipo_id, valor } = await req.json()
  if (!atributo_tipo_id || !valor?.trim()) {
    return NextResponse.json({ error: 'atributo_tipo_id y valor son obligatorios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('atributo_valores')
    .insert({ atributo_tipo_id: Number(atributo_tipo_id), valor: valor.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
