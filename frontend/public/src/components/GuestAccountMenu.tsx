import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useGuestContact } from '../api/hooks'
import type { HeaderTheme } from '../lib/theme'

export function GuestAccountMenu({ theme, onLogout }: { theme: HeaderTheme; onLogout?: () => void }) {
  const { data } = useGuestContact()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const focusLast = useRef(false)
  const location = useLocation()
  const initials = [data?.firstName, data?.lastName].map(name => Array.from(name?.trim() ?? '')[0] ?? '').join('').toUpperCase() || '?'
  const fullName = [data?.firstName, data?.lastName].filter(Boolean).join(' ')
  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])
  const close = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }

  useEffect(() => { setOpen(false) }, [location])
  useEffect(() => {
    if (!open) return
    const choices = items()
    choices[focusLast.current ? choices.length - 1 : 0]?.focus()
    focusLast.current = false
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  return (
    <div ref={root} className="relative" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) close() }}>
      <button ref={trigger} type="button" aria-label={fullName ? `Account menu for ${fullName}` : 'Guest account menu'} title={fullName || 'Guest account'}
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? 'guest-account-menu' : undefined}
        onClick={() => setOpen(value => !value)}
        onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); focusLast.current = e.key === 'ArrowUp'; setOpen(true) } }}
        className="h-11 w-11 rounded-full border border-current flex items-center justify-center text-sm font-semibold text-ink hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        style={{ color: theme.color }}>
        <span aria-hidden="true">{initials}</span>
      </button>
      {open && (
        <div ref={menu} id="guest-account-menu" role="menu" aria-label="Guest account" className="absolute right-0 top-full mt-2 z-50 w-44 rounded-lg border border-ink/15 bg-paper text-ink shadow-lg p-1"
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return }
            const choices = items()
            const index = choices.indexOf(document.activeElement as HTMLElement)
            const next = e.key === 'ArrowDown' ? (index + 1) % choices.length : e.key === 'ArrowUp' ? (index - 1 + choices.length) % choices.length : e.key === 'Home' ? 0 : e.key === 'End' ? choices.length - 1 : undefined
            if (next !== undefined) { e.preventDefault(); choices[next]?.focus() }
          }}>
          <Link role="menuitem" tabIndex={-1} to="/contact-info" onClick={() => close()} className="block rounded-md px-4 py-3 text-sm hover:bg-accent/10 focus:bg-accent/10 focus:outline-none">Contact Info</Link>
          <button role="menuitem" tabIndex={-1} type="button" disabled={!onLogout} onClick={() => { close(); onLogout?.() }} className="block w-full text-left rounded-md px-4 py-3 text-sm hover:bg-accent/10 focus:bg-accent/10 focus:outline-none disabled:opacity-50">Log Out</button>
        </div>
      )}
    </div>
  )
}
