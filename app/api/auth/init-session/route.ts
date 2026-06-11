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
      const { data: us } = await supabase
        .from('user_sucursales')
        .select('sucursal_id')
        .eq('user_id', session.user.id)
        .eq('sucursal_id', desiredId)
        .single()
      if (us) {
        const { data: suc } = await supabase
          .from('sucursales')
          .select('id')
          .eq('id', desiredId)
          .eq('activo', true)
          .single()
        if (suc) sucursalId = suc.id as number
      }
    }
  }

  if (!sucursalId) {
    if (isAdmin) {
      // Preferir sucursal 1 como default; si no existe o está inactiva, tomar la primera por nombre
      const { data: suc1 } = await supabase
        .from('sucursales')
        .select('id')
        .eq('id', 1)
        .eq('activo', true)
        .single()
      if (suc1) {
        sucursalId = suc1.id as number
      } else {
        const { data } = await supabase
          .from('sucursales')
          .select('id')
          .eq('activo', true)
          .order('nombre')
          .limit(1)
          .single()
        sucursalId = (data?.id as number) ?? null
      }
    } else {
      // Get user's sucursal IDs, then pick the first active one — must match the activo=true
      // filter applied in DashboardLayout.getSucursales() to avoid a redirect loop.
      const { data: rows } = await supabase
        .from('user_sucursales')
        .select('sucursal_id')
        .eq('user_id', session.user.id)
      const ids = (rows ?? []).map((r: { sucursal_id: number }) => r.sucursal_id)
      if (ids.length > 0) {
        const { data } = await supabase
          .from('sucursales')
          .select('id')
          .in('id', ids)
          .eq('activo', true)
          .order('nombre')
          .limit(1)
          .single()
        sucursalId = (data?.id as number) ?? null
      }
    }
  }

  // No sucursal available for this user — force sign-out
  if (!sucursalId) {
    const res = NextResponse.redirect(new URL('/auth/signin?error=SinSucursal', req.url))
    // Clear NextAuth JWT session cookies — name matches the custom name in lib/auth.ts
    res.cookies.delete('next-auth.session-token')
    res.cookies.delete('__Secure-next-auth.session-token')
    res.cookies.delete('next-auth.csrf-token')
    res.cookies.delete('__Host-next-auth.csrf-token')
    res.cookies.delete(SUCURSAL_COOKIE)
    return res
  }

  const res = NextResponse.redirect(new URL('/dashboard', req.url))
  const cookieOpts = { path: '/', sameSite: 'strict' as const, httpOnly: true }
  res.cookies.set(SUCURSAL_COOKIE, String(sucursalId), cookieOpts)
  res.cookies.set(SUCURSAL_HOME_COOKIE, String(sucursalId), cookieOpts)
  return res
}
