import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ImportarProveedoresClient from './_client'

export default async function ImportarProveedoresPage() {
  const session = await auth()
  if (session?.user.role !== 'Administrador') redirect('/dashboard/inventario/proveedores')
  return <ImportarProveedoresClient />
}
