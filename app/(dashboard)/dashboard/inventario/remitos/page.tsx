import { auth } from '@/lib/auth'
import RemitosClient from './_client'

export default async function RemitosPage() {
  const session = await auth()
  const isAdmin = session?.user.role === 'Administrador'
  return <RemitosClient isAdmin={isAdmin} />
}
