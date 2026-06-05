import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

type Ctx = { params: Promise<{ id: string; tareaId: string }> }

async function derivarEstadoServicio(
  supabase: Awaited<ReturnType<typeof import('@/services/supabase-tenant').getTenantClient>>,
  servicioId: number
): Promise<string> {
  const { data: tareas } = await supabase
    .from('optica_servicio_tareas')
    .select('estado')
    .eq('servicio_id', servicioId)

  const todas = tareas ?? []
  if (todas.length === 0) return 'pendiente'
  if (todas.every(t => t.estado === 'terminada')) return 'terminado'
  return 'en_proceso'
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id, tareaId } = await params
  const body = await req.json()

  const ESTADOS = ['en_proceso', 'terminada']
  const estado: string | undefined = body.estado && ESTADOS.includes(body.estado) ? body.estado : undefined

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.titulo?.trim()) updateData.titulo = body.titulo.trim()
  if (body.descripcion !== undefined) updateData.descripcion = body.descripcion?.trim() || null
  if (estado) {
    updateData.estado   = estado
    updateData.fecha_fin = estado === 'terminada'
      ? (body.fecha_fin || new Date().toISOString().slice(0, 10))
      : null
  }
  if (body.usuario_id !== undefined) updateData.usuario_id = body.usuario_id || null

  const { data: tarea, error } = await supabase
    .from('optica_servicio_tareas')
    .update(updateData)
    .eq('id', tareaId)
    .eq('servicio_id', id)
    .select('*, users!usuario_id(name, email)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let nuevoEstadoSV: string | null = null

  const { data: servicioActual } = await supabase
    .from('optica_servicios')
    .select('estado')
    .eq('id', id)
    .single()

  const estadosFinales = ['entregado', 'anulado']
  if (servicioActual && !estadosFinales.includes(servicioActual.estado) && estado) {
    nuevoEstadoSV = await derivarEstadoServicio(supabase, Number(id))
    await supabase
      .from('optica_servicios')
      .update({ estado: nuevoEstadoSV, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  return NextResponse.json({ tarea, nuevo_estado_sv: nuevoEstadoSV })
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id, tareaId } = await params

  const { error } = await supabase
    .from('optica_servicio_tareas')
    .delete()
    .eq('id', tareaId)
    .eq('servicio_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: servicioActual } = await supabase
    .from('optica_servicios')
    .select('estado')
    .eq('id', id)
    .single()

  const estadosFinales = ['entregado', 'anulado']
  let nuevoEstadoSV: string | null = null

  if (servicioActual && !estadosFinales.includes(servicioActual.estado)) {
    nuevoEstadoSV = await derivarEstadoServicio(supabase, Number(id))
    await supabase
      .from('optica_servicios')
      .update({ estado: nuevoEstadoSV, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  return NextResponse.json({ ok: true, nuevo_estado_sv: nuevoEstadoSV })
}
