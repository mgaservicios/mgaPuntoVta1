import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'

type Ctx = { params: Promise<{ id: string }> }

async function derivarEstadoServicio(
  supabase: Awaited<ReturnType<typeof import('@/services/supabase-tenant').getTenantClient>>,
  servicioId: number,
  tareaEstado: string
): Promise<string> {
  if (tareaEstado !== 'terminada') return tareaEstado

  const { data: tareas } = await supabase
    .from('optica_servicio_tareas')
    .select('estado')
    .eq('servicio_id', servicioId)

  const todas = tareas ?? []
  if (todas.length > 0 && todas.every(t => t.estado === 'terminada')) return 'terminado'
  return 'en_proceso'
}

export async function GET(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data, error } = await supabase
    .from('optica_servicio_tareas')
    .select('*, users!usuario_id(name, email)')
    .eq('servicio_id', id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('optica.servicios.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()

  const titulo = body.titulo?.trim()
  if (!titulo) return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })

  const ESTADOS = ['en_proceso', 'terminada']
  const estado: string = ESTADOS.includes(body.estado) ? body.estado : 'en_proceso'

  const { data: tarea, error: tareaError } = await supabase
    .from('optica_servicio_tareas')
    .insert({
      servicio_id: Number(id),
      titulo,
      descripcion: body.descripcion?.trim() || null,
      estado,
      fecha:      body.fecha || new Date().toISOString().slice(0, 10),
      fecha_fin:  estado === 'terminada' ? (body.fecha_fin || new Date().toISOString().slice(0, 10)) : null,
      usuario_id: body.usuario_id || null,
      created_by: session.user.id,
    })
    .select('*, users!usuario_id(name, email)')
    .single()

  if (tareaError) return NextResponse.json({ error: tareaError.message }, { status: 500 })

  const nuevoEstadoSV = await derivarEstadoServicio(supabase, Number(id), estado)

  const { data: servicioActual } = await supabase
    .from('optica_servicios')
    .select('estado')
    .eq('id', id)
    .single()

  const estadosFinales = ['entregado', 'anulado']
  if (servicioActual && !estadosFinales.includes(servicioActual.estado)) {
    await supabase
      .from('optica_servicios')
      .update({ estado: nuevoEstadoSV, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  return NextResponse.json({ tarea, nuevo_estado_sv: nuevoEstadoSV }, { status: 201 })
}
