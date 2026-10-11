import { useState } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Calendar, Hotel, FileDown, Globe, Mail, LogOut, KeyRound, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from './auth/AuthContext'
import { LoginPage } from './auth/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { PartiesPage } from './pages/parties/PartiesPage'
import { PartyDetailPage } from './pages/parties/PartyDetailPage'
import { EventsPage } from './pages/events/EventsPage'
import { VenueDetailPage } from './pages/venues/VenueDetailPage'
import { AccommodationsPage } from './pages/accommodations/AccommodationsPage'
import { InvitationsPage } from './pages/invitations/InvitationsPage'
import { ReportsPage } from './pages/reports/ReportsPage'
import { SitePage } from './pages/site/SitePage'
import { PasskeysPage } from './pages/PasskeysPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/parties', icon: Users, label: 'Parties & Guests' },
  { to: '/events', icon: Calendar, label: 'Events & Venues' },
  { to: '/accommodations', icon: Hotel, label: 'Accommodations' },
  { to: '/invitations', icon: Mail, label: 'Invitations' },
  { to: '/site', icon: Globe, label: 'Wedding Site' },
  { to: '/reports', icon: FileDown, label: 'Reports' },
  { to: '/passkeys', icon: KeyRound, label: 'Passkeys' },
]

function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('wedding-planner-sidebar-collapsed')
      if (saved !== null) return saved === 'true'
    } catch { /* Navigation still works when browser storage is unavailable. */ }
    return window.matchMedia('(max-width: 767px)').matches
  })

  const toggleSidebar = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem('wedding-planner-sidebar-collapsed', String(next))
    } catch { /* Keep the preference for this session if it cannot be saved. */ }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className={`${collapsed ? 'w-16' : 'w-56'} bg-gray-900 text-gray-100 flex flex-col shrink-0 transition-[width] duration-200 motion-reduce:transition-none`}>
        <div className={`flex items-center min-h-20 border-b border-gray-700 ${collapsed ? 'justify-center px-2' : 'justify-between gap-2 px-4'}`}>
          {!collapsed && <div>
            <p className="text-sm font-bold text-white">Wedding Planner</p>
            <p className="text-xs text-gray-400 mt-0.5">Internal Tool</p>
          </div>}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            aria-controls="planner-navigation"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-2 rounded-md text-gray-300 hover:bg-gray-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 shrink-0"
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>
        <nav id="planner-navigation" aria-label="Planner navigation" className="flex-1 py-4 space-y-0.5 px-2">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${collapsed ? 'justify-center' : ''} ${isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
              }
            >
              <Icon size={16} className="shrink-0" aria-hidden="true" />
              <span className={collapsed ? 'sr-only' : undefined}>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-2 pb-4">
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-400 hover:bg-gray-800 hover:text-white w-full transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={16} className="shrink-0" aria-hidden="true" />
            <span className={collapsed ? 'sr-only' : undefined}>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route index element={<DashboardPage />} />
              <Route path="parties" element={<PartiesPage />} />
              <Route path="parties/:id" element={<PartyDetailPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="venues/:id" element={<VenueDetailPage />} />
              <Route path="accommodations" element={<AccommodationsPage />} />
              <Route path="invitations" element={<InvitationsPage />} />
              <Route path="site" element={<SitePage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="passkeys" element={<PasskeysPage />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  )
}
