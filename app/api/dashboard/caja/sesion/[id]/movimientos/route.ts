import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { assertHomeSucursal } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data, error } = await supabase
    .from('caja_movimientos')
    .select('*')
    .eq('sesion_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()

  const tipo = body.tipo
  const tipo_concepto = body.tipo_concepto?.trim() || null
  const concepto = body.concepto?.trim() || ''
  const monto = parseFloat(body.monto ?? '0')

  if (!['ingreso', 'egreso'].includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  if (!tipo_concepto && !concepto) return NextResponse.json({ error: 'El concepto es obligatorio' }, { status: 400 })
  if (isNaN(monto) || monto <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })

  const { data: sesion } = await supabase
    .from('caja_sesiones')
    .select('estado, sucursal_id')
    .eq('id', id)
    .single()

  if (!sesion) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  const guard = await assertHomeSucursal(sesion.sucursal_id)
  if (guard) return guard

  if (sesion.estado !== 'abierta')
    return NextResponse.json({ error: 'La sesión no está abierta' }, { status: 400 })

  const { data, error } = await supabase
    .from('caja_movimientos')
    .insert({ sesion_id: Number(id), tipo, tipo_concepto, concepto, monto, usuario_id: session.user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
