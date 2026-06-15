import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || !session.user.empresa_id) redirect('/auth/signin')
  return <>{children}</>
}
