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
    .from('sucursales')
    .select('id, nombre, direccion, activo, logo_url, color, controla_stock, created_at')
    .order('nombre')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { nombre, direccion, logo_url, color, controla_stock } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  const { data, error } = await supabase
    .from('sucursales')
    .insert({ nombre: nombre.trim(), direccion: direccion?.trim() || null, logo_url: logo_url || null, color: color || null, controla_stock: controla_stock ?? false })
    .select('id, nombre, direccion, activo, logo_url, color, controla_stock')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
