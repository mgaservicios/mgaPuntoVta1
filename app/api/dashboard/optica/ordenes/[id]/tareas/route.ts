import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data, error } = await supabase
    .from('optica_orden_tareas')
    .select('*, users!usuario_id(name, email)')
    .eq('orden_id', id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

async function derivarEstadoOT(
  supabase: Awaited<ReturnType<typeof import('@/services/supabase-tenant').getTenantClient>>,
  ordenId: number,
  tareaEstado: string
): Promise<string> {
  if (tareaEstado !== 'terminada') {
    return tareaEstado
  }

  // Verificar si todas las tareas están terminadas
  const { data: tareas } = await supabase
    .from('optica_orden_tareas')
    .select('estado')
    .eq('orden_id', ordenId)

  const todas = tareas ?? []
  if (todas.length > 0 && todas.every(t => t.estado === 'terminada')) {
    return 'terminado'
  }

  // No todas terminadas: prioridad en_laboratorio > en_proceso
  const hayLab = todas.some(t => t.estado === 'en_laboratorio')
  return hayLab ? 'en_laboratorio' : 'en_proceso'
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('optica.ordenes.editar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()

  const titulo = body.titulo?.trim()
  if (!titulo) return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })

  const ESTADOS = ['en_proceso', 'en_laboratorio', 'terminada']
  const estado: string = ESTADOS.includes(body.estado) ? body.estado : 'en_proceso'

  const { data: tarea, error: tareaError } = await supabase
    .from('optica_orden_tareas')
    .insert({
      orden_id: Number(id),
      titulo,
      descripcion: body.descripcion?.trim() || null,
      estado,
      fecha: body.fecha || new Date().toISOString().slice(0, 10),
      fecha_fin: estado === 'terminada' ? (body.fecha_fin || new Date().toISOString().slice(0, 10)) : null,
      usuario_id: body.usuario_id || null,
      laboratorio_nombre: body.laboratorio_nombre?.trim() || null,
      laboratorio_tipo: body.laboratorio_tipo || null,
      created_by: session.user.id,
    })
    .select('*, users!usuario_id(name, email)')
    .single()

  if (tareaError) return NextResponse.json({ error: tareaError.message }, { status: 500 })

  // Derivar estado de la OT
  const nuevoEstadoOT = await derivarEstadoOT(supabase, Number(id), estado)

  const { data: ordenActual } = await supabase
    .from('optica_ordenes')
    .select('estado')
    .eq('id', id)
    .single()

  // Solo actualizar si el estado de la OT no está en estados finales manuales
  const estadosFinales = ['entregado', 'anulado']
  if (ordenActual && !estadosFinales.includes(ordenActual.estado)) {
    await supabase
      .from('optica_ordenes')
      .update({ estado: nuevoEstadoOT, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  return NextResponse.json({ tarea, nuevo_estado_ot: nuevoEstadoOT }, { status: 201 })
}
