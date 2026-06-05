import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { data } = await supabase
    .from('articulos')
    .select('codigo')
    .not('codigo', 'is', null)

  let maxNum = 0
  for (const row of (data ?? [])) {
    const match = row.codigo?.match(/^ART(\d+)$/i)
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10))
  }

  return NextResponse.json({ codigo: `ART${String(maxNum + 1).padStart(3, '0')}` })
}
