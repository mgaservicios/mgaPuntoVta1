import { auth } from '@/lib/auth'
import OpticaOrdenesClient from './_client'

export default async function OpticaOrdenesPage() {
  const session = await auth()
  const isAdmin = session?.user.role === 'Administrador'
  return <OpticaOrdenesClient isAdmin={isAdmin} />
}
