import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { setToken, setUnauthorizedHandler } from '../api/client'

const STORAGE_KEY = 'wedding_guest_token'

interface GuestAuthCtx {
  isAuthenticated: boolean
  login: (token: string) => void
  logout: () => void
}

const GuestAuthContext = createContext<GuestAuthCtx | null>(null)

export function GuestAuthProvider({ children }: { children: ReactNode }) {
  // Unlike the planner UI (memory-only token), guest sessions persist in sessionStorage:
  // low-sensitivity content, mobile guests refresh constantly, and the 2-hour token would
  // otherwise force re-verification on every navigation.
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      setToken(stored)
      setIsAuthenticated(true)
    }
  }, [])

  const login = useCallback((token: string) => {
    sessionStorage.setItem(STORAGE_KEY, token)
    setToken(token)
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setIsAuthenticated(false)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  return <GuestAuthContext.Provider value={{ isAuthenticated, login, logout }}>{children}</GuestAuthContext.Provider>
}

export function useGuestAuth(): GuestAuthCtx {
  const ctx = useContext(GuestAuthContext)
  if (!ctx) throw new Error('useGuestAuth must be used inside GuestAuthProvider')
  return ctx
}
