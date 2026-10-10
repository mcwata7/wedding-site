import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { setToken, setUnauthorizedHandler } from '../api/client'

const STORAGE_KEY = 'wedding_guest_token'

interface GuestAuthCtx {
  contactDismissed: boolean
  dismissContact: () => void
  isAuthenticated: boolean
  login: (token: string) => void
  logout: () => void
}

const GuestAuthContext = createContext<GuestAuthCtx | null>(null)

export function GuestAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [contactDismissed, setContactDismissed] = useState(() => sessionStorage.getItem('wedding_contact_dismissed') === localStorage.getItem(STORAGE_KEY) && !!localStorage.getItem(STORAGE_KEY))
  const dismissContact = useCallback(() => {
    sessionStorage.setItem('wedding_contact_dismissed', localStorage.getItem(STORAGE_KEY) ?? '')
    setContactDismissed(true)
  }, [])
  // Unlike the planner UI (memory-only token), guest sessions persist in localStorage:
  // low-sensitivity content, and guests come back to the site repeatedly over months from the
  // same phone -- sessionStorage would make them re-verify every time they closed the tab.
  // Paired with a long (30-day) guest token server-side.
  //
  // Rehydration must be synchronous (lazy initial state), not a useEffect: GuestRoute reads
  // isAuthenticated on the very first render and effects run after that commit, so a `false`
  // starting value would redirect to /unlock on every hard refresh before the effect ever ran
  // -- discarding the current URL, including any #section hash, in the process.
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) { setToken(stored); return true }
    return false
  })

  const login = useCallback((token: string) => {
    queryClient.clear()
    sessionStorage.removeItem('wedding_contact_dismissed')
    setContactDismissed(false)
    localStorage.setItem(STORAGE_KEY, token)
    setToken(token)
    setIsAuthenticated(true)
  }, [queryClient])

  const logout = useCallback(() => {
    queryClient.clear()
    sessionStorage.removeItem('wedding_contact_dismissed')
    setContactDismissed(false)
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setIsAuthenticated(false)
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  return <GuestAuthContext.Provider value={{ isAuthenticated, login, logout, contactDismissed, dismissContact }}>{children}</GuestAuthContext.Provider>
}

export function useGuestAuth(): GuestAuthCtx {
  const ctx = useContext(GuestAuthContext)
  if (!ctx) throw new Error('useGuestAuth must be used inside GuestAuthProvider')
  return ctx
}
