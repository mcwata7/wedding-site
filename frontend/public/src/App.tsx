import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useGuestAuth } from './auth/GuestAuthContext'
import { InvitePage } from './auth/InvitePage'
import { UnlockPage } from './auth/UnlockPage'
import { HomePage } from './pages/HomePage'
import { SchedulePage } from './pages/SchedulePage'
import { TravelPage } from './pages/TravelPage'
import { ThingsToDoPage } from './pages/ThingsToDoPage'
import { ContentPage } from './pages/ContentPage'
import { useSiteConfig } from './api/hooks'

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useGuestAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/unlock" replace />
}

function Layout({ children }: { children: React.ReactNode }) {
  const { data } = useSiteConfig()
  const pages = data?.pages ?? []

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink/10 bg-paper/95 backdrop-blur sticky top-0 z-40">
        <nav className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-center gap-1 overflow-x-auto">
          {pages.map(p => (
            <NavLink
              key={p.slug}
              to={p.slug === 'home' ? '/' : `/${p.slug}`}
              end={p.slug === 'home'}
              className={({ isActive }) =>
                `px-3 py-1.5 text-sm tracking-wide whitespace-nowrap rounded-md transition-colors ${
                  isActive ? 'text-accent font-medium' : 'text-ink/60 hover:text-ink'
                }`
              }
            >
              {p.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">{children}</div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/i/:qrToken" element={<InvitePage />} />
      <Route path="/unlock" element={<UnlockPage />} />
      <Route
        path="/*"
        element={
          <GuestRoute>
            <Layout>
              <Routes>
                <Route index element={<HomePage />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="travel" element={<TravelPage />} />
                <Route path="things-to-do" element={<ThingsToDoPage />} />
                <Route path=":slug" element={<ContentPage />} />
              </Routes>
            </Layout>
          </GuestRoute>
        }
      />
    </Routes>
  )
}
