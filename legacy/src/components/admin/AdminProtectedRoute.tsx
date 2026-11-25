import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { isModOrAdmin } from '@/lib/admin'

export function AdminProtectedRoute() {
  const { user, status } = useAuth()
  if (!user) return null
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') {
      setChecking(false)
      setAuthorized(false)
      return
    }
    isModOrAdmin(user.uid).then((ok) => {
      setAuthorized(ok)
      setChecking(false)
    })
  }, [status, user?.uid])

  if (status === 'loading' || checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    )
  }

  if (status === 'unauthenticated') return <Navigate to="/login" replace />
  if (!authorized) return <Navigate to="/" replace />

  return <Outlet />
}
