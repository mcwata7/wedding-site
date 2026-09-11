import { Routes, Route, NavLink, Link, Navigate, useLocation } from 'react-router-dom'
import { useGuestAuth } from './auth/GuestAuthContext'
import { UnlockPage } from './auth/UnlockPage'
import { HomePage } from './pages/HomePage'
import { SchedulePage } from './pages/SchedulePage'
import { TravelPage } from './pages/TravelPage'
import { ThingsToDoPage } from './pages/ThingsToDoPage'
import { FaqPage } from './pages/FaqPage'
import { ContentPage } from './pages/ContentPage'
import { OnePage } from './pages/OnePage'
import { LoadingSpinner, ScrollToTopButton } from './components'
import { useSiteConfig, useSiteLayout, useSectionPages, ROUTED_SLUGS } from './api/hooks'
import { useActiveSection, useOverflowFade } from './lib/scroll'
import { useSiteTheme, type HeaderTheme } from './lib/theme'
import type { SitePage } from './api/types'

/** When no header_font_color is set, today's fixed text-accent/text-ink classes apply verbatim
 * (byte-identical to before this feature existed). When one IS set, both active and inactive
 * states switch to an inline `color` (see NavItem) instead -- so these classes drop their own
 * color, keeping only the active state's font-medium/bg-accent/10 "you are here" tint, which
 * isn't itself a customizable field. sizeClass replaces the previously-hardcoded text-sm. */
const NAV_ITEM_CLASS = (active: boolean, sizeClass: string, hasCustomColor: boolean) =>
  `px-3 py-1.5 ${sizeClass} tracking-wide whitespace-nowrap rounded-md transition-colors ${
    active
      ? `font-medium bg-accent/10 ${hasCustomColor ? '' : 'text-accent'}`
      : hasCustomColor ? '' : 'text-ink/60 hover:text-ink'
  }`

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useGuestAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/unlock" replace />
}

/** A single nav item. In multi-page mode (or for a routed slug like rsvp, in either mode) it's
 * today's NavLink to its own route. In single-page mode it's a link to the matching #section --
 * still a real <Link> (so middle-click/copy-link work), with useHashScroll (mounted by OnePage)
 * doing the actual scrolling once the hash changes. */
function NavItem({ page, layout, activeSection, theme }: { page: SitePage; layout: 'MULTI_PAGE' | 'SINGLE_PAGE'; activeSection?: string; theme: HeaderTheme }) {
  const hasCustomColor = theme.color !== undefined
  const colorFor = (active: boolean) => (hasCustomColor ? (active ? theme.color : theme.inactiveColor) : undefined)

  if (layout === 'MULTI_PAGE' || ROUTED_SLUGS.has(page.slug)) {
    return (
      <NavLink
        to={page.slug === 'home' ? '/' : `/${page.slug}`}
        end={page.slug === 'home'}
        className={({ isActive }) => NAV_ITEM_CLASS(isActive, theme.sizeClass, hasCustomColor)}
        style={({ isActive }) => ({ color: colorFor(isActive) })}
      >
        {page.label}
      </NavLink>
    )
  }
  const active = activeSection === page.slug
  return (
    <Link
      to={{ pathname: '/', hash: page.slug === 'home' ? '' : `#${page.slug}` }}
      className={NAV_ITEM_CLASS(active, theme.sizeClass, hasCustomColor)}
      style={{ color: colorFor(active) }}
    >
      {page.label}
    </Link>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useSiteConfig()
  const layout = useSiteLayout()
  // Only ever mounted inside GuestRoute, so this is the one place site-wide theming (including
  // the document-root mutations for color/font-size) takes effect -- /unlock
  // never mounts Layout, so they stay on the fixed branded look with no extra scoping logic.
  const theme = useSiteTheme()
  const pages = data?.pages ?? []
  const sectionSlugs = useSectionPages().map(p => p.slug)
  const activeSection = useActiveSection(layout === 'SINGLE_PAGE' ? sectionSlugs : [])
  const { ref: navRef, fadeLeft, fadeRight } = useOverflowFade<HTMLElement>(pages.length)

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="border-b-2 border-maroon/20 bg-paper/95"
        style={{ backgroundColor: theme.style.backgroundColor }}
      >
        <nav
          ref={navRef}
          className="nav-scroll max-w-3xl mx-auto px-4 py-3 flex items-center gap-1 overflow-x-auto"
          style={{ fontFamily: theme.style.fontFamily }}
          data-fade-left={fadeLeft}
          data-fade-right={fadeRight}
        >
          {pages.map(p => (
            <NavItem key={p.slug} page={p} layout={layout} activeSection={activeSection} theme={theme} />
          ))}
        </nav>
      </header>
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">{isLoading ? <LoadingSpinner /> : children}</div>
      </main>
      <ScrollToTopButton />
    </div>
  )
}

/** In single-page mode, any URL that used to be its own route (/travel, /schedule, ...) still
 * needs to work -- old links, a bookmark, a QR-adjacent URL a guest already has -- so it
 * redirects to the matching #section instead of 404ing. An unrecognized or now-hidden slug goes
 * home, matching ContentPage's existing "unknown slug" rule. */
function SectionRedirect() {
  const { data } = useSiteConfig()
  const { pathname } = useLocation()
  const slug = pathname.split('/').filter(Boolean)[0] ?? ''
  const isVisibleSection = (data?.pages ?? []).some(p => p.slug === slug && !ROUTED_SLUGS.has(p.slug))
  return <Navigate to={isVisibleSection ? `/#${slug}` : '/'} replace />
}

export default function App() {
  const layout = useSiteLayout()

  return (
    <Routes>
      {/* Guests now identify themselves by name, so the invitation token in a printed card's QR
          URL is no longer an entry credential -- already-mailed /i/:token links land on /unlock. */}
      <Route path="/i/*" element={<Navigate to="/unlock" replace />} />
      <Route path="/unlock" element={<UnlockPage />} />
      <Route
        path="/*"
        element={
          <GuestRoute>
            <Layout>
              {layout === 'SINGLE_PAGE' ? (
                <Routes>
                  <Route index element={<OnePage />} />
                  <Route path="rsvp" element={<ContentPage slug="rsvp" />} />
                  <Route path="*" element={<SectionRedirect />} />
                </Routes>
              ) : (
                <Routes>
                  <Route index element={<HomePage />} />
                  <Route path="schedule" element={<SchedulePage />} />
                  <Route path="travel" element={<TravelPage />} />
                  <Route path="things-to-do" element={<ThingsToDoPage />} />
                  <Route path="faq" element={<FaqPage />} />
                  <Route path=":slug" element={<ContentPage />} />
                </Routes>
              )}
            </Layout>
          </GuestRoute>
        }
      />
    </Routes>
  )
}
