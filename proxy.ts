import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

type ProxySession = { user?: { role?: string } } | null

export default auth((req) => {
  const session = req.auth as ProxySession
  const pathname = req.nextUrl.pathname

  // Superadmin routes: auth independiente de NextAuth
  if (pathname.startsWith('/superadmin')) {
    if (pathname !== '/superadmin/login') {
      const saCookie = req.cookies.get('sa_session')
      if (!saCookie?.value) {
        return NextResponse.redirect(new URL('/superadmin/login', req.url))
      }
    }
    const res = NextResponse.next()
    res.headers.set('x-pathname', pathname)
    return res
  }

  if (pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/auth/signin', req.url))
  }

  if (session) {
    if (pathname === '/auth/signin' || pathname === '/auth/registro') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // Inject pathname so the dashboard layout can check route-level permissions
  const res = NextResponse.next()
  res.headers.set('x-pathname', pathname)
  return res
})

export const config = {
  matcher: ['/((?!api/auth|api/superadmin|_next/static|_next/image|favicon.ico).*)'],
}
