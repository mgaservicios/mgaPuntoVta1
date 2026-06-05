import { auth } from '@/lib/auth'
import OrdenesClient from './_client'

export default async function OrdenesPage() {
  const session = await auth()
  const isAdmin = session?.user.role === 'Administrador'
  return <OrdenesClient isAdmin={isAdmin} />
}
