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
  const { empresa_id, sucursal_id } = body

  if (!empresa_id || typeof empresa_id !== 'string') {
    return NextResponse.json({ error: 'empresa_id requerido' }, { status: 400 })
  }
  if (!sucursal_id || typeof sucursal_id !== 'string') {
    return NextResponse.json({ error: 'sucursal_id requerido' }, { status: 400 })
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

    // Verify the sucursal exists in this tenant
    const { data: sucursal, error: sucError } = await tenantClient
      .from('sucursales')
      .select('id, nombre')
      .eq('id', sucursal_id)
      .single()

    if (sucError || !sucursal) {
      return NextResponse.json({ error: 'Sucursal no encontrada en esta empresa' }, { status: 404 })
    }

    const { error: rpcError } = await tenantClient.rpc('reset_stock_sucursal', {
      p_sucursal_id: Number(sucursal_id),
    })

    if (rpcError) {
      const detail = rpcError.message.includes('schema cache')
        ? `La función reset_stock_sucursal no existe en la BD del tenant. Aplicar la migración 20260723_reset_stock_precios.sql en el proyecto Supabase de "${empresa.nombre}".`
        : `Error al limpiar stock: ${rpcError.message}`
      return NextResponse.json({ error: detail }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      message: `Stock de "${sucursal.nombre}" en "${empresa.nombre}" limpiado exitosamente`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error desconocido' },
      { status: 500 }
    )
  }
}
