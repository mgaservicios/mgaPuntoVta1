'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'

/**
 * Detects a new browser session using sessionStorage (which Chrome never restores
 * across browser restarts, unlike cookies). If no mark is found, signs out.
 * The mark is set in the sign-in page after a successful login.
 */
export function SessionGuard() {
  useEffect(() => {
    if (!sessionStorage.getItem('session_active')) {
      signOut({ callbackUrl: '/auth/signin' })
    }
  }, [])
  return null
}
