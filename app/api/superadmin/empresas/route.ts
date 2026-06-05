import { NextRequest, NextResponse } from 'next/server'
import { validateSuperadminCookie } from '@/lib/superadmin-auth'
import { supabaseMaster } from '@/services/supabase-master'

export async function GET(req: NextRequest) {
  const cookieVal = req.cookies.get('sa_session')?.value
  if (!cookieVal || !validateSuperadminCookie(cookieVal)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data, error } = await supabaseMaster
    .from('empresas')
    .select('id, nombre, codigo, activo')
    .order('nombre')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
