import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)
  const { id } = await params

  const { data, error } = await supabase
    .from('formas_pago_cuotas')
    .select('id, cantidad_cuotas, recargo_pct')
    .eq('forma_pago_id', id)
    .order('cantidad_cuotas')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)
  const { id } = await params
  const body = await req.json()

  const cantCuotas = parseInt(body.cantidad_cuotas)
  const recargo    = parseFloat(body.recargo_pct ?? '0')
  if (isNaN(cantCuotas) || cantCuotas < 1) return NextResponse.json({ error: 'cantidad_cuotas inválido' }, { status: 400 })
  if (isNaN(recargo) || recargo < 0)        return NextResponse.json({ error: 'recargo_pct inválido' }, { status: 400 })

  const { data, error } = await supabase
    .from('formas_pago_cuotas')
    .insert({ forma_pago_id: id, cantidad_cuotas: cantCuotas, recargo_pct: recargo })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const cuotaId = searchParams.get('cuota_id')
  if (!cuotaId) return NextResponse.json({ error: 'cuota_id requerido' }, { status: 400 })

  const { error } = await supabase
    .from('formas_pago_cuotas')
    .delete()
    .eq('id', cuotaId)
    .eq('forma_pago_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
