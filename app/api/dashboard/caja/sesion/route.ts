import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'
import { getSucursalFilter, getHomeSucursalId, assertActiveSucursalIsHome } from '@/lib/sucursal'

// GET — sesión abierta de la sucursal que se está viendo + flag isHome
// Cuando verTodas=true siempre muestra la home (única que puede operar el usuario)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const [{ sucursalId: activoId, verTodas }, homeId] = await Promise.all([
    getSucursalFilter(),
    getHomeSucursalId(),
  ])

  // En modo "ver todas" siempre mostramos la caja home; fuera de ese modo, la seleccionada
  const sucursalId = verTodas ? homeId : activoId
  if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const [sessionRes, sucursalRes] = await Promise.all([
    supabase
      .from('caja_sesiones')
      .select('*, users(name, email)')
      .eq('estado', 'abierta')
      .eq('sucursal_id', sucursalId)
      .maybeSingle(),
    supabase
      .from('sucursales')
      .select('nombre')
      .eq('id', sucursalId)
      .single(),
  ])

  return NextResponse.json({
    sesion: sessionRes.data ?? null,
    isHome: sucursalId === homeId,
    sucursalNombre: sucursalRes.data?.nombre ?? null,
  })
}

// POST — abrir nueva sesión para la sucursal activa
export async function POST(req: NextRequest) {
  const session = await requirePermission('caja.caja.abrir')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const sucursalId = await getHomeSucursalId()
  if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const guardCreate = await assertActiveSucursalIsHome()
  if (guardCreate) return guardCreate

  const body = await req.json()
  const monto_apertura = parseFloat(body.monto_apertura ?? '0')
  if (isNaN(monto_apertura) || monto_apertura < 0)
    return NextResponse.json({ error: 'Monto de apertura inválido' }, { status: 400 })

  // Verificar que no haya sesión abierta en esta sucursal
  const { data: existing } = await supabase
    .from('caja_sesiones')
    .select('id')
    .eq('estado', 'abierta')
    .eq('sucursal_id', sucursalId)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Ya hay una caja abierta en esta sucursal' }, { status: 409 })

  const { data, error } = await supabase
    .from('caja_sesiones')
    .insert({ usuario_id: session.user.id, monto_apertura, sucursal_id: sucursalId, vendedor_id: body.vendedor_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (monto_apertura > 0) {
    await supabase.from('caja_movimientos').insert({
      sesion_id: data.id,
      tipo: 'ingreso',
      tipo_concepto: 'Apertura',
      concepto: 'Apertura de caja',
      monto: monto_apertura,
      usuario_id: session.user.id,
    })
  }

  return NextResponse.json(data, { status: 201 })
}
