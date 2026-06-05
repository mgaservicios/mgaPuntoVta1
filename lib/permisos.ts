import { supabaseAdmin } from '@/services/supabase-admin'

export type ModulePermisos = {
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
}

const FULL: ModulePermisos = { can_view: true, can_create: true, can_edit: true, can_delete: true }
const NONE: ModulePermisos = { can_view: false, can_create: false, can_edit: false, can_delete: false }

export async function getModulePermisos(
  roleId: number,
  role: string,
  module: string
): Promise<ModulePermisos> {
  if (role === 'Administrador') return FULL
  const { data } = await supabaseAdmin
    .from('role_permissions')
    .select('can_view, can_create, can_edit, can_delete')
    .eq('role_id', roleId)
    .eq('module', module)
    .single()
  return data ?? NONE
}
