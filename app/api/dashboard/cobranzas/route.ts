import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { getHomeSucursalId } from '@/lib/sucursal'

// GET — movimientos de cobranzas con info del cliente y documento origen
// ?tipo=PAGO|CARGO  filtra por tipo
// ?cliente_id=N     filtra por cliente
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { searchParams } = new URL(req.url)
  const tipo      = searchParams.get('tipo')
  const clienteId = searchParams.get('cliente_id')

  let q = supabase
    .from('cobranzas')
    .select('id, tipo, monto, fecha, descripcion, metodo, created_at, cliente_id, clientes(nombre), venta_id, orden_id, optica_orden_id, optica_servicio_id')
    .order('created_at', { ascending: false })

  if (tipo)      q = q.eq('tipo', tipo)
  if (clienteId) q = q.eq('cliente_id', parseInt(clienteId, 10))

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — registrar un cobro (PAGO) contra el saldo de un cliente
export async function POST(req: NextRequest) {
  const session = await requirePermission('caja.cobranzas.ver')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const body = await req.json()
  const cliente_id = Number(body.cliente_id)
  const monto = parseFloat(body.monto ?? '0')
  const descripcion = body.descripcion?.trim() || 'Cobro'
  const fecha = body.fecha || new Date().toISOString().slice(0, 10)
  const metodo = body.metodo ?? null

  if (!cliente_id) return NextResponse.json({ error: 'Cliente requerido' }, { status: 400 })
  if (isNaN(monto) || monto <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })

  const sucursalId = await getHomeSucursalId()

  const { data: cobro, error } = await supabase
    .from('cobranzas')
    .insert({
      cliente_id,
      tipo: 'PAGO',
      monto,
      fecha,
      descripcion,
      metodo,
      sucursal_id: sucursalId ?? null,
      usuario_id: session.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Registrar ingreso en caja si hay sesión abierta
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
