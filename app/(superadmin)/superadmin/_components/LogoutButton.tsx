'use client'

export default function LogoutButton() {
  async function handleLogout() {
    await fetch('/api/superadmin/auth', { method: 'DELETE' })
    window.location.href = '/superadmin/login'
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-gray-400 hover:text-gray-100 transition-colors"
    >
      Cerrar sesión
    </button>
  )
}
