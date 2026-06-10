import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data, error } = await supabase
    .from('cobranzas')
    .select(`
      id, tipo, monto, fecha, descripcion, metodo, created_at,
      cliente_id, clientes(nombre),
      sucursal_id, sucursales(nombre, logo_url),
      venta_id, orden_id, optica_orden_id, optica_servicio_id
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Saldo del cliente al momento del cobro (calculado del historial)
  const { data: historial } = await supabase
    .from('cobranzas')
    .select('tipo, monto')
    .eq('cliente_id', data.cliente_id)

  const saldoTotal = (historial ?? []).reduce(
    (acc, c) => acc + (c.tipo === 'CARGO' ? Number(c.monto) : -Number(c.monto)),
    0
  )

  return NextResponse.json({ ...data, saldo_actual: saldoTotal })
}
