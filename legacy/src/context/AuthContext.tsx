import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthChange, logOut } from '@/lib/firebase'
import { toAppUser, type AppUser } from '@/types'

type AuthContextValue = {
  user: AppUser | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  useEffect(() => {
    const unsub = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        setUser(toAppUser(firebaseUser))
        setStatus('authenticated')
      } else {
        setUser(null)
        setStatus('unauthenticated')
      }
    })
    return unsub
  }, [])

  const signOut = async () => {
    await logOut()
  }

  return (
    <AuthContext.Provider value={{ user, status, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useAuthenticatedUser(): AppUser {
  const { user, status } = useAuth()
  if (status !== 'authenticated' || !user) {
    throw new Error('useAuthenticatedUser must be used within an authenticated route')
  }
  return user
}

export function useRequiredAuth() {
  const { signOut } = useAuth()
  const user = useAuthenticatedUser()
  return { user, status: 'authenticated' as const, signOut }
}
