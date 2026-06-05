import { createHash, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'sa_session'

function deriveToken(): string {
  const secret = process.env.SUPERADMIN_SECRET
  if (!secret) throw new Error('SUPERADMIN_SECRET no configurado')
  return createHash('sha256').update(secret + ':sa_v1').digest('hex')
}

export function setSuperadminCookie(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_NAME, deriveToken(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8,
  })
  return response
}

export function clearSuperadminCookie(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  })
  return response
}

export function validateSuperadminCookie(cookieValue: string): boolean {
  try {
    const expected = deriveToken()
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(cookieValue, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function isValidSuperadminSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const val = cookieStore.get(COOKIE_NAME)?.value
  if (!val) return false
  return validateSuperadminCookie(val)
}
