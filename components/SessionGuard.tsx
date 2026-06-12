'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'

/**
 * Forces re-login when the browser is closed and reopened.
 *
 * Uses two storage keys:
 *  - sessionStorage 'session_active'  → cleared automatically on browser close
 *  - localStorage   'has_logged_in'   → persists across sessions
 *
 * Logic:
 *  - Both present      → normal navigation within session, do nothing.
 *  - Neither present   → first run after deploy on an old session; set both and continue
 *                        (avoids disrupting existing logged-in users on first deploy).
 *  - localStorage only → browser was closed and reopened → force re-login.
 *  - sessionStorage only → shouldn't happen; treat as valid session.
 */
export function SessionGuard() {
  useEffect(() => {
    const inSession  = sessionStorage.getItem('session_active')
    const hasEverLogged = localStorage.getItem('has_logged_in')

    if (inSession) return // normal case: active browser session

    if (!hasEverLogged) {
      // Old session from before this feature was deployed — mark and continue
      sessionStorage.setItem('session_active', '1')
      localStorage.setItem('has_logged_in', '1')
      return
    }

    // localStorage exists but sessionStorage is gone → browser was closed → sign out
    signOut({ callbackUrl: '/auth/signin' })
  }, [])
  return null
}
