import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'
import { assertHomeSucursal } from '@/lib/sucursal'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data, error } = await supabase
    .from('ventas')
    .select(`
      *,
      clientes(nombre),
      vendedores(nombre),
      sucursales(nombre, logo_url),
      venta_items(*),
      venta_pagos(*)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'Administrador') {
    return NextResponse.json({ error: 'Solo un administrador puede eliminar ventas' }, { status: 403 })
  }
  const supabase = await getTenantClient(session)

  const { id } = await params

  const { data: venta, error: fetchError } = await supabase
    .from('ventas')
    .select('id, numero, total, fecha, sucursal_id, estado, cliente_id, clientes(nombre)')
    .eq('id', id)
    .single()

  if (fetchError || !venta) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const guard = await assertHomeSucursal(venta.sucursal_id)
  if (guard) return guard

  if (venta.estado !== 'anulada') {
    return NextResponse.json({ error: 'Solo se pueden eliminar ventas anuladas' }, { status: 409 })
  }

  const { error } = await supabase.from('ventas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('eliminaciones_log').insert({
    tipo: 'venta',
    referencia_id: Number(id),
    numero: venta.numero,
    cliente_nombre: (() => { const c = venta.clientes as unknown; return (Array.isArray(c) ? (c as {nombre:string}[])[0]?.nombre : (c as {nombre:string}|null)?.nombre) ?? null })(),
    total: venta.total,
    fecha_documento: venta.fecha,
    sucursal_id: venta.sucursal_id,
    estado_previo: venta.estado,
    usuario_id: session.user.id,
    datos_extra: { cliente_id: venta.cliente_id },
  })

  return NextResponse.json({ ok: true })
}
