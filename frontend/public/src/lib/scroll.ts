import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Scrolls to a section id (or the top when id is falsy), respecting reduced-motion. Used both
 * by an explicit nav click (smooth) and by the hash-driven effect below (instant). */
export function scrollToSection(id: string | undefined, opts: { smooth?: boolean } = {}) {
  const behavior: ScrollBehavior = opts.smooth && !prefersReducedMotion() ? 'smooth' : 'auto'
  if (!id) { window.scrollTo({ top: 0, behavior }); return }
  document.getElementById(id)?.scrollIntoView({ behavior, block: 'start' })
}

/** Scrolls to whatever #section the URL currently names, once `ready` (the single-page
 * composite's content has actually rendered). The browser's native anchor scroll fires before
 * React Query has rendered anything and silently finds nothing, and React Router doesn't scroll
 * on client-side hash changes either -- so this is the one mechanism behind every path that can
 * land on an anchor: a cold deep link, the /travel -> /#travel redirect, a nav-item click, and
 * back/forward. A plain <Link> changing the hash is all a nav item needs to do; this hook is
 * what actually moves the viewport, so there's no separate onClick scroll logic to keep in sync.
 *
 * The *first* time content becomes ready is treated as an arrival (instant jump) rather than a
 * user-driven move (smooth) -- otherwise a cold deep link or the /travel redirect would animate
 * past every section on the way to its target instead of landing there directly. Any hash change
 * after that (a nav click, back/forward while still mounted) scrolls smoothly. */
export function useHashScroll(ready: boolean) {
  const { hash } = useLocation() // react-router's location updates on hash-only navigation too,
  const lastHandled = useRef<string | null>(null) // unlike reading window.location directly.
  const wasReady = useRef(false)

  useEffect(() => {
    if (!ready) { wasReady.current = false; return }
    const justArrived = !wasReady.current
    wasReady.current = true
    if (hash === lastHandled.current && !justArrived) return
    lastHandled.current = hash
    scrollToSection(hash ? hash.slice(1) : undefined, { smooth: !justArrived })
  }, [ready, hash])
}

/** Reports whether a horizontally scrollable element still has content past its left or right
 * edge, so the header nav can fade that edge in place of the scrollbar it hides (see .nav-scroll
 * in index.css). `itemCount` re-subscribes when the nav's items change (a planner showing or
 * hiding a page), since the observers below are attached per element.
 *
 * The children are observed, not just the container: what moves the overflow boundary is usually
 * the *content* reflowing inside a container whose own box never changes -- a decorative script
 * face swapping in for the fallback stack, or the planner changing header_font_size. Observing
 * only the container misses both. `document.fonts.ready` is not sufficient on its own either: it
 * resolves against the loads pending when it is read, so on a cold load it can settle before the
 * chosen face has even been requested, leaving the fade stuck off until the first scroll. */
export function useOverflowFade<T extends HTMLElement>(itemCount: number) {
  const ref = useRef<T>(null)
  const [fade, setFade] = useState({ left: false, right: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const max = el.scrollWidth - el.clientWidth
      const left = el.scrollLeft > 1 // 1px slack: fractional scroll offsets never settle on exact 0
      const right = el.scrollLeft < max - 1
      // Same-value updates must return the previous object, or every scroll event re-renders the
      // whole header (and with it every nav item) for nothing.
      setFade(prev => (prev.left === left && prev.right === right ? prev : { left, right }))
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    document.fonts?.ready.then(update)

    return () => { el.removeEventListener('scroll', update); observer.disconnect() }
  }, [itemCount])

  return { ref, fadeLeft: fade.left, fadeRight: fade.right }
}

/** Tracks which section id is currently in view, for highlighting the matching nav item in
 * single-page mode (NavLink's own isActive never fires for an anchor). Deliberately does not
 * write the active id back into the URL hash -- that would spam browser history on every scroll
 * and fight momentum scrolling on mobile; the hash only ever changes from an explicit nav click. */
export function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0])

  useEffect(() => {
    if (ids.length === 0) return
    const elements = ids.map(id => document.getElementById(id)).filter((el): el is HTMLElement => el != null)
    if (elements.length === 0) return

    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting)
      if (visible.length === 0) return // keep the previous value rather than flicker off
      const firstVisible = ids.find(id => visible.some(e => e.target.id === id))
      if (firstVisible) setActive(firstVisible)
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 })
    elements.forEach(el => observer.observe(el))

    // A short last section (e.g. one line of FAQ) may never cross the observer's middle band
    // even at max scroll -- force it once the page is scrolled to the bottom, or the last nav
    // item could never highlight. The observer alone can't catch this: it only fires on
    // intersection changes, which may have stopped happening well before the true bottom.
    const checkBottom = () => {
      if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 2) setActive(ids[ids.length - 1])
    }
    window.addEventListener('scroll', checkBottom, { passive: true })
    checkBottom()

    return () => { observer.disconnect(); window.removeEventListener('scroll', checkBottom) }
  }, [ids.join(',')])

  return active
}
