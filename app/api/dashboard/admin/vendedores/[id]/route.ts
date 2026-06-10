import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

async function requireAdmin() {
  const session = await auth()
  if (!session) return null
  if (session.user.role !== 'Administrador') return null
  return session
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const { data, error } = await supabase
    .from('vendedores')
    .select('id, nombre, sucursal_id, activo')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const { nombre, sucursal_id, activo } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  if (!sucursal_id) return NextResponse.json({ error: 'La sucursal es obligatoria' }, { status: 400 })

  const { data, error } = await supabase
    .from('vendedores')
    .update({ nombre: nombre.trim(), sucursal_id: Number(sucursal_id), activo, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, nombre, sucursal_id, activo')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  // Verificar que no haya transacciones asociadas
  const [{ count: cv }, { count: cot }] = await Promise.all([
    supabase.from('ventas').select('id', { count: 'exact', head: true }).eq('vendedor_id', id),
    supabase.from('optica_ordenes').select('id', { count: 'exact', head: true }).eq('vendedor_id', id),
  ])
  if ((cv ?? 0) + (cot ?? 0) > 0) {
    return NextResponse.json(
      { error: 'No se puede eliminar un vendedor con transacciones asociadas.' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('vendedores').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
