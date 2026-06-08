import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { SUCURSAL_COOKIE, SUCURSAL_HOME_COOKIE } from '@/lib/sucursal'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.redirect(new URL('/auth/signin', req.url))
  }

  const supabase = await getTenantClient(session)
  const isAdmin = session.user.role === 'Administrador'

  const desiredIdStr = req.nextUrl.searchParams.get('sucursal_id')
  const desiredId = desiredIdStr ? parseInt(desiredIdStr, 10) : null

  let sucursalId: number | null = null

  if (desiredId) {
    if (isAdmin) {
      const { data } = await supabase
        .from('sucursales')
        .select('id')
        .eq('id', desiredId)
        .eq('activo', true)
        .single()
      if (data) sucursalId = data.id as number
    } else {
      const { data } = await supabase
        .from('user_sucursales')
        .select('sucursal_id')
        .eq('user_id', session.user.id)
        .eq('sucursal_id', desiredId)
        .single()
      if (data) sucursalId = data.sucursal_id as number
    }
  }

  if (!sucursalId) {
    if (isAdmin) {
      const { data } = await supabase
        .from('sucursales')
        .select('id')
        .eq('activo', true)
        .order('nombre')
        .limit(1)
        .single()
      sucursalId = (data?.id as number) ?? null
    } else {
      const { data } = await supabase
        .from('user_sucursales')
        .select('sucursal_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .single()
      sucursalId = (data?.sucursal_id as number) ?? null
    }
  }

  // No sucursal available for this user — force sign-out
  if (!sucursalId) {
    const res = NextResponse.redirect(new URL('/auth/signin?error=SinSucursal', req.url))
    // Clear NextAuth JWT session cookies (both HTTP and HTTPS variants)
    res.cookies.delete('authjs.session-token')
    res.cookies.delete('__Secure-authjs.session-token')
    res.cookies.delete('authjs.csrf-token')
    res.cookies.delete('__Host-authjs.csrf-token')
    res.cookies.delete(SUCURSAL_COOKIE)
    return res
  }

  const res = NextResponse.redirect(new URL('/dashboard', req.url))
  const cookieOpts = { path: '/', sameSite: 'strict' as const, httpOnly: true }
  res.cookies.set(SUCURSAL_COOKIE, String(sucursalId), cookieOpts)
  res.cookies.set(SUCURSAL_HOME_COOKIE, String(sucursalId), cookieOpts)
  return res
}
