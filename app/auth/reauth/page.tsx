'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { Loader2 } from 'lucide-react'

export default function ReauthPage() {
  useEffect(() => {
    signOut({ callbackUrl: '/auth/signin' })
  }, [])

  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <Loader2 className="w-4 h-4 animate-spin" />
      Actualizando sesión…
    </div>
  )
}
