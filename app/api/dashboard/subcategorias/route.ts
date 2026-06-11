import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const categoriaId = req.nextUrl.searchParams.get('categoria_id')
  let query = supabase
    .from('subcategorias')
    .select('id, nombre, categoria_id, activo, categorias(id, nombre)')
    .eq('activo', true)
    .order('nombre')

  if (categoriaId) query = query.eq('categoria_id', categoriaId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('altas.subcategorias.crear')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { nombre, categoria_id } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  if (!categoria_id) return NextResponse.json({ error: 'La categoría es obligatoria' }, { status: 400 })

  const { data, error } = await supabase
    .from('subcategorias')
    .insert({ nombre: nombre.trim(), categoria_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
