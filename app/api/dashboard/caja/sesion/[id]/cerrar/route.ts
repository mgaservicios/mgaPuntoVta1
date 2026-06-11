import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { assertHomeSucursal } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('caja.caja.cerrar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()
  const monto_cierre = parseFloat(body.monto_cierre ?? '0')
  if (isNaN(monto_cierre) || monto_cierre < 0)
    return NextResponse.json({ error: 'Monto de cierre inválido' }, { status: 400 })

  const { data: sesion } = await supabase
    .from('caja_sesiones')
    .select('id, estado, sucursal_id')
    .eq('id', id)
    .single()

  if (!sesion) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const guard = await assertHomeSucursal(sesion.sucursal_id)
  if (guard) return guard

  if (sesion.estado !== 'abierta') return NextResponse.json({ error: 'La caja ya está cerrada' }, { status: 400 })

  // Calcular monto esperado
  const { data: esperado } = await supabase.rpc('caja_monto_esperado', { p_sesion_id: Number(id) })

  const monto_esperado = esperado ?? 0
  const diferencia = monto_cierre - monto_esperado

  const fechaCierreRaw = body.fecha_cierre ? new Date(body.fecha_cierre) : new Date()
  const fecha_cierre = isNaN(fechaCierreRaw.getTime()) ? new Date() : fechaCierreRaw

  const { data, error } = await supabase
    .from('caja_sesiones')
    .update({
      estado: 'cerrada',
      fecha_cierre: fecha_cierre.toISOString(),
      monto_cierre,
      monto_esperado,
      diferencia,
      observaciones: body.observaciones || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
