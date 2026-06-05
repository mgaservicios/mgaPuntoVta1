import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data: nc } = await supabase
    .from('notas_credito')
    .select('estado')
    .eq('id', id)
    .single()

  if (!nc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (nc.estado === 'anulada') return NextResponse.json({ error: 'La nota de crédito ya está anulada' }, { status: 400 })
  if (nc.estado === 'utilizada') return NextResponse.json({ error: 'No se puede anular una nota de crédito ya utilizada' }, { status: 400 })

  await supabase
    .from('notas_credito')
    .update({ estado: 'anulada', monto_disponible: 0, updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
