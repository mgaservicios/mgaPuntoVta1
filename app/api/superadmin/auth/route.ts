import { NextRequest, NextResponse } from 'next/server'
import { setSuperadminCookie, clearSuperadminCookie } from '@/lib/superadmin-auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 })
  }

  if (password !== process.env.SUPERADMIN_SECRET) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  return setSuperadminCookie(NextResponse.json({ ok: true }))
}

export async function DELETE() {
  return clearSuperadminCookie(NextResponse.json({ ok: true }))
}
