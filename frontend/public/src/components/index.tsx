import { createContext, useContext, useCallback, useState, type ReactNode } from 'react'

// --- Toast ---
interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}
interface ToastCtx {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
}
const ToastContext = createContext<ToastCtx | null>(null)

let _nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, type: Toast['type']) => {
    const id = ++_nextId
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const ctx: ToastCtx = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }

  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-accent' }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`${colors[t.type]} text-white text-sm px-4 py-3 rounded-lg shadow-lg max-w-xs`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}

// --- Loading / Error states ---
export function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-16">
      <div className="w-8 h-8 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
    </div>
  )
}

export function ErrorMessage({ message }: { message: string }) {
  return <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">{message}</div>
}

// --- Page layout helpers ---
// Defaults to h1, one per routed page. In single-page mode, Section below provides 'h2' so a
// page composed of several sections on one document doesn't emit five <h1>s -- the page
// components themselves (HomePage, SchedulePage, ...) don't know or care which mode they're in.
const HeadingLevelContext = createContext<'h1' | 'h2'>('h1')

export function PageHeading({ eyebrow, title }: { eyebrow?: string; title: string }) {
  const Tag = useContext(HeadingLevelContext)
  return (
    <div className="text-center mb-10">
      {eyebrow && <p className="text-xs tracking-[0.2em] uppercase text-accent mb-2">{eyebrow}</p>}
      <Tag className="font-display text-4xl text-ink">{title}</Tag>
    </div>
  )
}

/** Wraps one page's content as an anchored section for single-page mode: gives it the nav's
 * scroll target (`id`) and enough scroll-margin to clear the sticky header, and drops the
 * heading level inside to h2. Vertical spacing between sections is left to the caller (a
 * `space-y-*` on the list) rather than margins here, so the first section -- typically Home,
 * whose hero relies on negative margins to break out of the page padding -- isn't pushed down. */
export function Section({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 sm:scroll-mt-24">
      <HeadingLevelContext.Provider value="h2">{children}</HeadingLevelContext.Provider>
    </section>
  )
}

/** Optional banner image shown above a page's heading, e.g. schedule_image_id / a
 * site_page's image_id. Renders nothing when the page has no image configured. */
export function PageBanner({ src }: { src?: string }) {
  if (!src) return null
  return (
    <div className="-mx-4 sm:mx-0 sm:rounded-lg overflow-hidden mb-8">
      <img src={src} alt="" className="w-full h-56 sm:h-72 object-cover" />
    </div>
  )
}
