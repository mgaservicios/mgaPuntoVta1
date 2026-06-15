import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requirePermission } from '@/lib/require-permission'
import { getTenantClient } from '@/services/supabase-tenant'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { data, error } = await supabase
    .from('formas_pago')
    .select('id, nombre, tipo, activo, orden, formas_pago_cuotas(id, cantidad_cuotas, recargo_pct)')
    .order('orden', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('altas.formas_pago.crear')
  if (!session) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const body = await req.json()
  if (!body.nombre?.trim()) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })
  const TIPOS = ['TARJETA_CREDITO', 'TARJETA_DEBITO', 'BANCARIA', 'BILLETERA', 'MONEDA']
  if (!TIPOS.includes(body.tipo)) return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })

  const { data, error } = await supabase
    .from('formas_pago')
    .insert({ nombre: body.nombre.trim(), tipo: body.tipo, orden: body.orden ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
