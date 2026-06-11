import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')
  const soloActivos = searchParams.get('activo') !== 'false'

  let query = supabase
    .from('proveedores')
    .select('*')
    .order('nombre')

  if (soloActivos) query = query.eq('activo', true)
  if (q) query = query.ilike('nombre', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('inventario.proveedores.crear')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const body = await req.json()
  const { nombre, cuit, telefono, email, direccion, localidad, provincia, cod_postal, contacto, tipo_iva, notas } = body

  if (!nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('proveedores')
    .insert({ nombre: nombre.trim(), cuit, telefono, email, direccion, localidad, provincia, cod_postal, contacto, tipo_iva, notas })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
