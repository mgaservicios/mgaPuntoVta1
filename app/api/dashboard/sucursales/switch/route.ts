import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { SUCURSAL_COOKIE, SUCURSAL_HOME_COOKIE, VER_TODAS_COOKIE } from '@/lib/sucursal'

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

  const cookieOpts = { path: '/', sameSite: 'strict' as const, httpOnly: true }

  // If SUCURSAL_HOME_COOKIE doesn't exist yet (old session), anchor it to the
  // current SUCURSAL_COOKIE value before any switch happens.
  const existingHome = req.cookies.get(SUCURSAL_HOME_COOKIE)?.value
  const currentSucursal = req.cookies.get(SUCURSAL_COOKIE)?.value

  // sucursal_id = 0 means "todas las sucursales" (admin only) — read-only view
  if (sucursal_id === 0) {
    if (!isAdmin) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
    const res = NextResponse.json({ ok: true })
    res.cookies.set(VER_TODAS_COOKIE, '1', cookieOpts)
    if (!existingHome && currentSucursal) {
      res.cookies.set(SUCURSAL_HOME_COOKIE, currentSucursal, cookieOpts)
    }
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
  res.cookies.set(SUCURSAL_COOKIE, String(sucursal_id), cookieOpts)
  res.cookies.delete(VER_TODAS_COOKIE)
  // Anchor home cookie on first switch if missing — captures login sucursal
  if (!existingHome && currentSucursal) {
    res.cookies.set(SUCURSAL_HOME_COOKIE, currentSucursal, cookieOpts)
  }
  return res
}
