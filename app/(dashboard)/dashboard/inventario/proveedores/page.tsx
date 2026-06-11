import { auth } from '@/lib/auth'
import ProveedoresClient from './_client'

export default async function ProveedoresPage() {
  const session = await auth()
  const isAdmin = session?.user.role === 'Administrador'
  return <ProveedoresClient isAdmin={isAdmin} />
}
