import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react'
import { setToken, setUnauthorizedHandler } from '../api/client'

interface AuthCtx {
  isAuthenticated: boolean
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  // token lives in a ref so it doesn't cause re-renders on every request
  const tokenRef = useRef<string | null>(null)

  const login = useCallback((token: string) => {
    tokenRef.current = token
    setToken(token)
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(() => {
    tokenRef.current = null
    setToken(null)
    setIsAuthenticated(false)
  }, [])

  // Register the 401 handler once
  useState(() => {
    setUnauthorizedHandler(logout)
  })

  return <AuthContext.Provider value={{ isAuthenticated, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
