import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { setToken, setUnauthorizedHandler } from '../api/client'

const STORAGE_KEY = 'wedding_guest_token'

interface GuestAuthCtx {
  saveTheDateDismissed: boolean
  dismissSaveTheDate: () => void
  contactDismissed: boolean
  dismissContact: () => void
  isAuthenticated: boolean
  login: (token: string) => void
  logout: () => void
}

const GuestAuthContext = createContext<GuestAuthCtx | null>(null)

export function GuestAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [saveTheDateDismissed, setSaveTheDateDismissed] = useState(() => {
    try {
      const token = localStorage.getItem(STORAGE_KEY)
      return !!token && sessionStorage.getItem('wedding_save_the_date_dismissed') === token
    } catch { return false }
  })
  const dismissSaveTheDate = useCallback(() => {
    try { sessionStorage.setItem('wedding_save_the_date_dismissed', localStorage.getItem(STORAGE_KEY) ?? '') } catch { /* Keep dismissal in memory if storage is unavailable. */ }
    setSaveTheDateDismissed(true)
  }, [])
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
    try { sessionStorage.removeItem('wedding_save_the_date_dismissed') } catch { /* In-memory state still resets. */ }
    setSaveTheDateDismissed(false)
    queryClient.clear()
    sessionStorage.removeItem('wedding_contact_dismissed')
    setContactDismissed(false)
    localStorage.setItem(STORAGE_KEY, token)
    setToken(token)
    setIsAuthenticated(true)
  }, [queryClient])

  const logout = useCallback(() => {
    // Clear the API credential before cache observers can start another request.
    setToken(null)
    setIsAuthenticated(false)
    setSaveTheDateDismissed(false)
    setContactDismissed(false)
    localStorage.removeItem(STORAGE_KEY)
    try {
      sessionStorage.removeItem('wedding_save_the_date_dismissed')
      sessionStorage.removeItem('wedding_contact_dismissed')
    } catch { /* Browser restrictions must not prevent clearing the login token. */ }
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setUnauthorizedHandler(logout)
  }, [logout])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === STORAGE_KEY || event.key === null) && !localStorage.getItem(STORAGE_KEY)) logout()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [logout])

  return <GuestAuthContext.Provider value={{ isAuthenticated, login, logout, contactDismissed, dismissContact, saveTheDateDismissed, dismissSaveTheDate }}>{children}</GuestAuthContext.Provider>
}

export function useGuestAuth(): GuestAuthCtx {
  const ctx = useContext(GuestAuthContext)
  if (!ctx) throw new Error('useGuestAuth must be used inside GuestAuthProvider')
  return ctx
}
