import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { requirePermission } from '@/lib/require-permission'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('admin.listas_precio.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()
  const { nombre, tipo, categoria, lista_base_id, porcentaje, activo } = body

  if (tipo === 'calculada' && !lista_base_id)
    return NextResponse.json({ error: 'Lista calculada requiere una lista base' }, { status: 400 })
  if (tipo === 'calculada' && (porcentaje == null || isNaN(Number(porcentaje))))
    return NextResponse.json({ error: 'Lista calculada requiere porcentaje' }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (nombre !== undefined) update.nombre = nombre.trim()
  if (categoria !== undefined) update.categoria = categoria
  if (tipo !== undefined) {
    update.tipo = tipo
    update.lista_base_id = tipo === 'calculada' ? (lista_base_id || null) : null
    update.porcentaje = tipo === 'calculada' ? Number(porcentaje) : null
  }
  if (activo !== undefined) update.activo = activo

  const { data, error } = await supabase
    .from('listas_precio')
    .update(update)
    .eq('id', id)
    .select('*, lista_base:lista_base_id(id, nombre)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('admin.listas_precio.eliminar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  // Verificar que no tenga precios asociados
  const { count } = await supabase
    .from('precios')
    .select('id', { count: 'exact', head: true })
    .eq('lista_precio_id', id)

  if (count && count > 0)
    return NextResponse.json(
      { error: 'No se puede eliminar: la lista tiene precios registrados' },
      { status: 409 },
    )

  const { error } = await supabase
    .from('listas_precio')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
