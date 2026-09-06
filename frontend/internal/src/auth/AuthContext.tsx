import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react'
import { setToken, setUnauthorizedHandler } from '../api/client'

interface AuthCtx {
  isAuthenticated: boolean
  /** ADMIN or PLANNER. Only used to hide admin-only affordances; the API enforces the real rule. */
  role: string | null
  login: (token: string, role: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  // token lives in a ref so it doesn't cause re-renders on every request
  const tokenRef = useRef<string | null>(null)

  const login = useCallback((token: string, role: string) => {
    tokenRef.current = token
    setToken(token)
    setRole(role)
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(() => {
    tokenRef.current = null
    setToken(null)
    setRole(null)
    setIsAuthenticated(false)
  }, [])

  // Register the 401 handler once
  useState(() => {
    setUnauthorizedHandler(logout)
  })

  return <AuthContext.Provider value={{ isAuthenticated, role, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
