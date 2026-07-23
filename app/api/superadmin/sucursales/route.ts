import { NextRequest, NextResponse } from 'next/server'
import { validateSuperadminCookie } from '@/lib/superadmin-auth'
import { supabaseMaster } from '@/services/supabase-master'
import { getTenantAdminClient } from '@/services/supabase-tenant'

export async function GET(req: NextRequest) {
  const cookieVal = req.cookies.get('sa_session')?.value
  if (!cookieVal || !validateSuperadminCookie(cookieVal)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const empresa_id = req.nextUrl.searchParams.get('empresa_id')
  if (!empresa_id || typeof empresa_id !== 'string') {
    return NextResponse.json({ error: 'empresa_id requerido' }, { status: 400 })
  }

  const { data: empresa, error: lookupError } = await supabaseMaster
    .from('empresas')
    .select('id')
    .eq('id', empresa_id)
    .single()

  if (lookupError || !empresa) {
    return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  }

  try {
    const tenantClient = await getTenantAdminClient(empresa_id)

    const { data: sucursales, error: sucError } = await tenantClient
      .from('sucursales')
      .select('id, nombre, activo')
      .order('nombre')

    if (sucError) {
      return NextResponse.json({ error: `Error al obtener sucursales: ${sucError.message}` }, { status: 500 })
    }

    return NextResponse.json(sucursales ?? [])
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
