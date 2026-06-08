import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getHomeSucursalId } from '@/lib/sucursal'

// GET — todos los movimientos de cobranzas con info del cliente
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { data, error } = await supabase
    .from('cobranzas')
    .select('id, tipo, monto, fecha, descripcion, created_at, cliente_id, clientes(nombre)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — registrar un cobro (PAGO) contra el saldo de un cliente
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const body = await req.json()
  const cliente_id = Number(body.cliente_id)
  const monto = parseFloat(body.monto ?? '0')
  const descripcion = body.descripcion?.trim() || 'Cobro'
  const fecha = body.fecha || new Date().toISOString().slice(0, 10)

  if (!cliente_id) return NextResponse.json({ error: 'Cliente requerido' }, { status: 400 })
  if (isNaN(monto) || monto <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })

  const { data: cobro, error } = await supabase
    .from('cobranzas')
    .insert({
      cliente_id,
      tipo: 'PAGO',
      monto,
      fecha,
      descripcion,
      usuario_id: session.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Registrar ingreso en caja si hay sesión abierta
  const sucursalId = await getHomeSucursalId()
  if (sucursalId) {
    const { data: cajaSesion } = await supabase
      .from('caja_sesiones')
      .select('id')
      .eq('estado', 'abierta')
      .eq('sucursal_id', sucursalId)
      .maybeSingle()

    if (cajaSesion) {
      await supabase.from('caja_movimientos').insert({
        sesion_id: cajaSesion.id,
        tipo: 'ingreso',
        concepto: descripcion,
        monto,
        usuario_id: session.user.id,
      })
    }
  }

  return NextResponse.json(cobro, { status: 201 })
}
