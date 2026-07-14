import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { assertHomeSucursal } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

// POST — Anular un movimiento de caja
// Body: { movimiento_id: number, motivo: string }
// Crea un movimiento inverso y registra en caja_movimientos_log
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('fondos.caja.anular')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()

  const movimiento_id = body.movimiento_id
  const motivo = body.motivo?.trim()

  if (!movimiento_id) {
    return NextResponse.json({ error: 'movimiento_id es requerido' }, { status: 400 })
  }
  if (!motivo) {
    return NextResponse.json({ error: 'El motivo es obligatorio' }, { status: 400 })
  }

  // 1. Verificar que la sesión exista y pertenezca a la sucursal home
  const { data: sesion } = await supabase
    .from('caja_sesiones')
    .select('id, estado, sucursal_id')
    .eq('id', id)
    .single()

  if (!sesion) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  const guard = await assertHomeSucursal(sesion.sucursal_id)
  if (guard) return guard

  // 2. Obtener el movimiento a anular
  const { data: movimiento } = await supabase
    .from('caja_movimientos')
    .select('*')
    .eq('id', movimiento_id)
    .eq('sesion_id', id)
    .single()

  if (!movimiento) {
    return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
  }

  // 3. No permitir anular movimientos de tipo "Apertura"
  if (movimiento.tipo_concepto === 'Apertura') {
    return NextResponse.json({ error: 'No se puede anular un movimiento de apertura' }, { status: 400 })
  }

  // 4. Verificar que no esté ya anulado (movimiento inverso ya creado)
  const { data: yaAnulado } = await supabase
    .from('caja_movimientos')
    .select('id')
    .eq('sesion_id', id)
    .eq('tipo_concepto', 'Anulación')
    .ilike('concepto', `%Anulación de movimiento #${movimiento_id}%`)
    .maybeSingle()

  if (yaAnulado) {
    return NextResponse.json({ error: 'Este movimiento ya fue anulado' }, { status: 400 })
  }

  // 5. Crear movimiento inverso
  const tipoInverso = movimiento.tipo === 'ingreso' ? 'egreso' : 'ingreso'
  const { data: movimientoInverso, error: inversoError } = await supabase
    .from('caja_movimientos')
    .insert({
      sesion_id: Number(id),
      tipo: tipoInverso,
      tipo_concepto: 'Anulación',
      concepto: `Anulación de movimiento #${movimiento_id} - ${movimiento.concepto}`,
      monto: movimiento.monto,
      usuario_id: session.user.id,
    })
    .select()
    .single()

  if (inversoError) return NextResponse.json({ error: inversoError.message }, { status: 500 })

  // 6. Registrar en log de auditoría
  await supabase.from('caja_movimientos_log').insert({
    movimiento_id: movimiento.id,
    sesion_id: Number(id),
    accion: 'anulacion',
    tipo: movimiento.tipo,
    tipo_concepto: movimiento.tipo_concepto,
    concepto: movimiento.concepto,
    monto: movimiento.monto,
    usuario_original: movimiento.usuario_id,
    motivo,
    usuario_anula: session.user.id,
  })

  return NextResponse.json({
    mensaje: 'Movimiento anulado correctamente',
    movimiento_inverso: movimientoInverso,
  })
}
