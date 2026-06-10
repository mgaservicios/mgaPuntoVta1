import { auth } from '@/lib/auth'
import HistorialClient from './_historial-client'

export default async function HistorialPage() {
  const session = await auth()
  const isAdmin = session?.user.role === 'Administrador'
  return <HistorialClient isAdmin={isAdmin} />
}
