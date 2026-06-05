import { auth } from '@/lib/auth'
import OpticaServiciosClient from './_client'

export default async function OpticaServiciosPage() {
  const session = await auth()
  const isAdmin = session?.user.role === 'Administrador'
  return <OpticaServiciosClient isAdmin={isAdmin} />
}
