import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantClient } from '@/services/supabase-tenant'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const supabase = await getTenantClient(session)

  const { data, error } = await supabase
    .from('listas_precio')
    .select('*, lista_base:lista_base_id(id, nombre)')
    .order('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

const ROLES_ESCRITURA = ['Administrador', 'Supervisor']

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!ROLES_ESCRITURA.includes(session.user.role))
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  const supabase = await getTenantClient(session)

  const body = await req.json()
  const { nombre, tipo = 'manual', categoria = 'venta', lista_base_id, porcentaje, activo = true } = body

  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  if (!['costo', 'venta'].includes(categoria))
    return NextResponse.json({ error: 'categoria debe ser costo o venta' }, { status: 400 })
  if (tipo === 'calculada' && !lista_base_id)
    return NextResponse.json({ error: 'Lista calculada requiere una lista base' }, { status: 400 })
  if (tipo === 'calculada' && (porcentaje == null || isNaN(Number(porcentaje))))
    return NextResponse.json({ error: 'Lista calculada requiere porcentaje' }, { status: 400 })

  const { data, error } = await supabase
    .from('listas_precio')
    .insert({
      nombre: nombre.trim(),
      tipo,
      categoria,
      lista_base_id: tipo === 'calculada' ? (lista_base_id || null) : null,
      porcentaje: tipo === 'calculada' ? Number(porcentaje) : null,
      activo,
    })
    .select('*, lista_base:lista_base_id(id, nombre)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
