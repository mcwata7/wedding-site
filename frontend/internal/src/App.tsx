import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Calendar, Hotel, FileDown, Globe, Mail, LogOut } from 'lucide-react'
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
]

function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-gray-900 text-gray-100 flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-700">
          <p className="text-sm font-bold text-white">Wedding Planner</p>
          <p className="text-xs text-gray-400 mt-0.5">Internal Tool</p>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-2 pb-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-400 hover:bg-gray-800 hover:text-white w-full transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
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
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  )
}
