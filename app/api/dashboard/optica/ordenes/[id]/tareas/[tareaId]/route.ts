import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'

type Ctx = { params: Promise<{ id: string; tareaId: string }> }

async function derivarEstadoOT(
  supabase: Awaited<ReturnType<typeof import('@/services/supabase-tenant').getTenantClient>>,
  ordenId: number
): Promise<string> {
  const { data: tareas } = await supabase
    .from('optica_orden_tareas')
    .select('estado')
    .eq('orden_id', ordenId)

  const todas = tareas ?? []
  if (todas.length === 0) return 'pendiente'

  if (todas.every(t => t.estado === 'terminada')) return 'terminado'

  const hayLab = todas.some(t => t.estado === 'en_laboratorio')
  return hayLab ? 'en_laboratorio' : 'en_proceso'
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('optica.ordenes.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id, tareaId } = await params
  const body = await req.json()

  const ESTADOS = ['en_proceso', 'en_laboratorio', 'terminada']
  const estado: string | undefined = body.estado && ESTADOS.includes(body.estado) ? body.estado : undefined

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (body.titulo?.trim()) updateData.titulo = body.titulo.trim()
  if (body.descripcion !== undefined) updateData.descripcion = body.descripcion?.trim() || null
  if (estado) {
    updateData.estado = estado
    updateData.fecha_fin = estado === 'terminada'
      ? (body.fecha_fin || new Date().toISOString().slice(0, 10))
      : null
  }
  if (body.usuario_id !== undefined) updateData.usuario_id = body.usuario_id || null
  if (body.laboratorio_nombre !== undefined) updateData.laboratorio_nombre = body.laboratorio_nombre?.trim() || null
  if (body.laboratorio_tipo !== undefined) updateData.laboratorio_tipo = body.laboratorio_tipo || null

  const { data: tarea, error } = await supabase
    .from('optica_orden_tareas')
    .update(updateData)
    .eq('id', tareaId)
    .eq('orden_id', id)
    .select('*, users!usuario_id(name, email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Derivar estado de la OT si el estado de tarea cambió
  let nuevoEstadoOT: string | null = null

  const { data: ordenActual } = await supabase
    .from('optica_ordenes')
    .select('estado')
    .eq('id', id)
    .single()

  const estadosFinales = ['entregado', 'anulado']
  if (ordenActual && !estadosFinales.includes(ordenActual.estado) && estado) {
    nuevoEstadoOT = await derivarEstadoOT(supabase, Number(id))
    await supabase
      .from('optica_ordenes')
      .update({ estado: nuevoEstadoOT, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  return NextResponse.json({ tarea, nuevo_estado_ot: nuevoEstadoOT })
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const session = await requirePermission('optica.ordenes.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id, tareaId } = await params

  const { error } = await supabase
    .from('optica_orden_tareas')
    .delete()
    .eq('id', tareaId)
    .eq('orden_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalcular estado de la OT tras eliminar
  const { data: ordenActual } = await supabase
    .from('optica_ordenes')
    .select('estado')
    .eq('id', id)
    .single()

  const estadosFinales = ['entregado', 'anulado']
  let nuevoEstadoOT: string | null = null

  if (ordenActual && !estadosFinales.includes(ordenActual.estado)) {
    nuevoEstadoOT = await derivarEstadoOT(supabase, Number(id))
    await supabase
      .from('optica_ordenes')
      .update({ estado: nuevoEstadoOT, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  return NextResponse.json({ ok: true, nuevo_estado_ot: nuevoEstadoOT })
}
