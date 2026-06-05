import { NextRequest, NextResponse } from 'next/server'
import { validateSuperadminCookie } from '@/lib/superadmin-auth'
import { supabaseMaster } from '@/services/supabase-master'
import { getTenantAdminClient } from '@/services/supabase-tenant'

export async function POST(req: NextRequest) {
  const cookieVal = req.cookies.get('sa_session')?.value
  if (!cookieVal || !validateSuperadminCookie(cookieVal)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { empresa_id } = body

  if (!empresa_id || typeof empresa_id !== 'string') {
    return NextResponse.json({ error: 'empresa_id requerido' }, { status: 400 })
  }

  const { data: empresa, error: lookupError } = await supabaseMaster
    .from('empresas')
    .select('id, nombre, codigo')
    .eq('id', empresa_id)
    .single()

  if (lookupError || !empresa) {
    return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  }

  try {
    const tenantClient = await getTenantAdminClient(empresa_id)
    const { error: rpcError } = await tenantClient.rpc('reset_tenant_data')
    if (rpcError) {
      return NextResponse.json({ error: `Error en reset: ${rpcError.message}` }, { status: 500 })
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error desconocido' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    message: `Datos de "${empresa.nombre}" (${empresa.codigo}) reseteados exitosamente`,
  })
}
