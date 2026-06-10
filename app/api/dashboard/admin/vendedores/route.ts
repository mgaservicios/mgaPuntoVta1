import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

async function requireAdmin() {
  const session = await auth()
  if (!session) return null
  if (session.user.role !== 'Administrador') return null
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { data, error } = await supabase
    .from('vendedores')
    .select('id, nombre, sucursal_id, activo, created_at, sucursales(nombre)')
    .order('nombre')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { nombre, sucursal_id } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  if (!sucursal_id) return NextResponse.json({ error: 'La sucursal es obligatoria' }, { status: 400 })

  const { data, error } = await supabase
    .from('vendedores')
    .insert({ nombre: nombre.trim(), sucursal_id: Number(sucursal_id) })
    .select('id, nombre, sucursal_id, activo, sucursales(nombre)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
