import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { SUCURSAL_COOKIE, VER_TODAS_COOKIE } from '@/lib/sucursal'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const body = await req.json()
  const { sucursal_id } = body
  if (sucursal_id === undefined || sucursal_id === null) {
    return NextResponse.json({ error: 'sucursal_id requerido' }, { status: 400 })
  }

  const isAdmin = session.user.role === 'Administrador'

  // sucursal_id = 0 means "todas las sucursales" (admin only)
  if (sucursal_id === 0) {
    if (!isAdmin) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
    const res = NextResponse.json({ ok: true })
    res.cookies.set(VER_TODAS_COOKIE, '1', { path: '/', sameSite: 'strict', httpOnly: true })
    return res
  }

  if (!isAdmin) {
    const { data } = await supabase
      .from('user_sucursales')
      .select('sucursal_id')
      .eq('user_id', session.user.id)
      .eq('sucursal_id', sucursal_id)
      .single()

    if (!data) return NextResponse.json({ error: 'Sin acceso a esa sucursal' }, { status: 403 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SUCURSAL_COOKIE, String(sucursal_id), {
    path: '/',
    sameSite: 'strict',
    httpOnly: true,
  })
  res.cookies.delete(VER_TODAS_COOKIE)
  return res
}
