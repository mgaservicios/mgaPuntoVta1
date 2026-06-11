import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseMaster } from '@/services/supabase-master'
import { getTenantAdminClient } from '@/services/supabase-tenant'

const schema = z.object({
  empresa_codigo: z.string().min(1),
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ found: false }, { status: 400 })

  const { empresa_codigo, email } = parsed.data

  const { data: empresa } = await supabaseMaster
    .from('empresas')
    .select('id')
    .eq('codigo', empresa_codigo.toUpperCase().trim())
    .eq('activo', true)
    .single()

  if (!empresa) return NextResponse.json({ found: false, reason: 'empresa_not_found' })

  const supabase = await getTenantAdminClient(empresa.id as string)

  const { data: user } = await supabase
    .from('users')
    .select('id, name, role_id')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!user) return NextResponse.json({ found: false, reason: 'user_not_found' })

  const { data: roleData } = await supabase
    .from('roles')
    .select('name')
    .eq('id', user.role_id)
    .single()

  const roleName = (roleData?.name as string) ?? 'Vendedor'
  const isAdmin = roleName === 'Administrador'

  type SucursalRow = { id: number; nombre: string }
  let sucursales: SucursalRow[] = []

  if (isAdmin) {
    const { data } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .eq('activo', true)
      .order('id')
    sucursales = (data ?? []) as SucursalRow[]
  } else {
    const { data } = await supabase
      .from('user_sucursales')
      .select('sucursales(id, nombre)')
      .eq('user_id', user.id)
    sucursales = (data ?? [])
      .flatMap((row) => (Array.isArray(row.sucursales) ? row.sucursales : [row.sucursales]))
      .filter(Boolean) as SucursalRow[]
  }

  return NextResponse.json({
    found: true,
    name: user.name,
    isAdmin,
    sucursales,
  })
}
