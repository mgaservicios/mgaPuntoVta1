import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { searchParams } = new URL(req.url)
  const clienteId = searchParams.get('cliente_id')
  const estado = searchParams.get('estado')

  let q = supabase
    .from('notas_credito')
    .select('*, clientes(nombre)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (clienteId) q = q.eq('cliente_id', parseInt(clienteId, 10))
  if (estado && estado !== 'todos') q = q.eq('estado', estado)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('ventas.notas-credito.crear')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const body = await req.json()
  const { cliente_id, monto, fecha, observaciones, vendedor_id } = body

  if (!cliente_id) return NextResponse.json({ error: 'Se requiere un cliente' }, { status: 400 })
  const montoNum = parseFloat(monto)
  if (!montoNum || montoNum <= 0) return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })

  const { count } = await supabase.from('notas_credito').select('id', { count: 'exact', head: true })
  const numero = `NC-${String((count ?? 0) + 1).padStart(5, '0')}`

  const { data, error } = await supabase
    .from('notas_credito')
    .insert({
      numero,
      cliente_id,
      fecha: fecha ?? new Date().toISOString().slice(0, 10),
      monto: montoNum,
      monto_disponible: montoNum,
      estado: 'pendiente',
      observaciones: observaciones?.trim() || null,
      vendedor_id: vendedor_id ?? null,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
