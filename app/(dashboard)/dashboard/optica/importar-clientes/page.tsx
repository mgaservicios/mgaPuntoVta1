import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ImportarClientesClient from './_client'

export default async function ImportarClientesPage() {
  const session = await auth()
  if (session?.user.role !== 'Administrador') redirect('/dashboard/optica/ordenes')
  return <ImportarClientesClient />
}
