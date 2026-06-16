import { auth } from '@/lib/auth'
import AtributosClient from './_client'

export default async function AtributosPage() {
  const session = await auth()
  const isAdmin = session?.user.role === 'Administrador'
  return <AtributosClient isAdmin={isAdmin} />
}
