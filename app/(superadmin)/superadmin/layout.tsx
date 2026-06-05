import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { isValidSuperadminSession } from '@/lib/superadmin-auth'
import LogoutButton from './_components/LogoutButton'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  const isLoginPage = pathname.startsWith('/superadmin/login')

  if (!isLoginPage) {
    const valid = await isValidSuperadminSession()
    if (!valid) redirect('/superadmin/login')
  }

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-red-400 uppercase tracking-widest">Superadmin</p>
          <h1 className="text-lg font-semibold">Panel de Administración MGA</h1>
        </div>
        <LogoutButton />
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
