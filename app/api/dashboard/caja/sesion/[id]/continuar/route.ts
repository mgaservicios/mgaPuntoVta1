import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { assertHomeSucursal } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

// POST — Continuar sesión: cerrar la sesión del día anterior y abrir una nueva
// Body: { accion: 'continuar' | 'cerrar_y_abrir', monto_cierre, observaciones, fecha_hora_cierre }
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await requirePermission('fondos.caja.cerrar')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const { id } = await params
  const body = await req.json()

  const accion = body.accion as 'continuar' | 'cerrar_y_abrir'
  if (!['continuar', 'cerrar_y_abrir'].includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  // 1. Obtener la sesión del día anterior
  const { data: sesion } = await supabase
    .from('caja_sesiones')
    .select('*')
    .eq('id', id)
    .single()

  if (!sesion) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const guard = await assertHomeSucursal(sesion.sucursal_id)
  if (guard) return guard

  if (sesion.estado !== 'abierta') {
    return NextResponse.json({ error: 'La sesión ya está cerrada' }, { status: 400 })
  }

  // 2. Calcular monto esperado de la sesión anterior
  const { data: esperado } = await supabase.rpc('caja_monto_esperado', { p_sesion_id: Number(id) })
  const monto_esperado = esperado ?? 0

  // 3. Determinar monto de cierre según la acción
  let monto_cierre: number
  if (accion === 'continuar') {
    // Para continuar, el monto de cierre es el monto esperado (saldo actual)
    monto_cierre = monto_esperado
  } else {
    // Para cerrar_y_abrir, usar el monto_cierre del body
    monto_cierre = parseFloat(body.monto_cierre ?? '0')
    if (isNaN(monto_cierre) || monto_cierre < 0) {
      return NextResponse.json({ error: 'Monto de cierre inválido' }, { status: 400 })
    }
  }

  const fechaCierreRaw = body.fecha_hora_cierre ? new Date(body.fecha_hora_cierre) : new Date()
  const fecha_cierre = isNaN(fechaCierreRaw.getTime()) ? new Date() : fechaCierreRaw
  const diferencia = monto_cierre - monto_esperado

  // 4. Cerrar la sesión anterior
  const { error: cerrarError } = await supabase
    .from('caja_sesiones')
    .update({
      estado: 'cerrada',
      fecha_cierre: fecha_cierre.toISOString(),
      monto_cierre,
      monto_esperado,
      diferencia,
      observaciones: body.observaciones || `Cierre automático por ${accion === 'continuar' ? 'continuación' : 'nueva sesión'}`,
    })
    .eq('id', id)

  if (cerrarError) return NextResponse.json({ error: cerrarError.message }, { status: 500 })

  // 5. Crear nueva sesión con el saldo como apertura
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

  const { data: nuevaSesion, error: crearError } = await supabase
    .from('caja_sesiones')
    .insert({
      usuario_id: session.user.id,
      monto_apertura: monto_cierre,
      sucursal_id: sesion.sucursal_id,
      fecha: hoy,
      sesion_anterior_id: sesion.id,
    })
    .select()
    .single()

  if (crearError) return NextResponse.json({ error: crearError.message }, { status: 500 })

  // 6. Registrar movimiento de "Continuación de caja anterior"
  if (monto_cierre > 0) {
    await supabase.from('caja_movimientos').insert({
      sesion_id: nuevaSesion.id,
      tipo: 'ingreso',
      tipo_concepto: 'Continuación',
      concepto: `Continuación de caja anterior (Sesión #${sesion.id})`,
      monto: monto_cierre,
      usuario_id: session.user.id,
    })
  }

  return NextResponse.json({
    sesion_anterior_cerrada: { id: sesion.id, monto_cierre, monto_esperado, diferencia },
    sesion_nueva: nuevaSesion,
  })
}
