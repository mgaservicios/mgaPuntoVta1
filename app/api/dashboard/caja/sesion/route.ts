import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { getActiveSucursalId } from '@/lib/sucursal'

// GET — sesión abierta actual para la sucursal activa (null si no hay)
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const sucursalId = await getActiveSucursalId()
  if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

  const { data } = await supabase
    .from('caja_sesiones')
    .select('*, users(name, email)')
    .eq('estado', 'abierta')
    .eq('sucursal_id', sucursalId)
    .maybeSingle()

  return NextResponse.json(data ?? null)
}

// POST — abrir nueva sesión para la sucursal activa
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const sucursalId = await getActiveSucursalId()
  if (!sucursalId) return NextResponse.json({ error: 'sin_sucursal_activa' }, { status: 403 })

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
    .insert({ usuario_id: session.user.id, monto_apertura, sucursal_id: sucursalId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
