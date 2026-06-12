import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)
  const { data } = await supabase.from('parametros').select('clave, valor')
  const map = Object.fromEntries((data ?? []).map((p: { clave: string; valor: string }) => [p.clave, p.valor]))
  return NextResponse.json(map)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'Administrador') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)
  const { clave, valor } = await req.json()
  if (!clave || valor === undefined) return NextResponse.json({ error: 'Falta clave o valor' }, { status: 400 })
  const { error } = await supabase
    .from('parametros')
    .update({ valor, updated_at: new Date().toISOString() })
    .eq('clave', clave)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
