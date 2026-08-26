import { useNavigate } from 'react-router-dom'
import { Users, Calendar, CheckSquare, Clock, AlertCircle } from 'lucide-react'
import { useDashboard } from '../api/hooks'
import { LoadingSpinner, ErrorMessage, PageHeader } from '../components'

interface StatCardProps {
  label: string
  value: number | undefined
  icon: React.ElementType
  color: string
  to?: string
  onClick?: () => void
}

function StatCard({ label, value, icon: Icon, color, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 p-6 flex items-center gap-4 ${onClick ? 'cursor-pointer hover:border-indigo-300 transition-colors' : ''}`}
    >
      <div className={`p-3 rounded-full ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading, error } = useDashboard()
  const navigate = useNavigate()

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={(error as Error).message} />

  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Parties" value={data?.parties} icon={Users} color="bg-indigo-500" onClick={() => navigate('/parties')} />
        <StatCard label="Guests" value={data?.guests} icon={Users} color="bg-blue-500" onClick={() => navigate('/parties')} />
        <StatCard label="Events" value={data?.events} icon={Calendar} color="bg-green-500" onClick={() => navigate('/events')} />
        <StatCard label="Attending" value={data?.attending} icon={CheckSquare} color="bg-teal-500" onClick={() => navigate('/rsvps')} />
        <StatCard label="Pending RSVPs" value={data?.pendingRsvps} icon={Clock} color="bg-yellow-500" onClick={() => navigate('/rsvps')} />
        <StatCard label="Accommodation Requests" value={data?.openChangeRequests} icon={AlertCircle} color={data?.openChangeRequests ? 'bg-red-500' : 'bg-gray-400'} onClick={() => navigate('/accommodations')} />
      </div>
      {data?.openChangeRequests ? (
        <div className="mt-6 rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{data.openChangeRequests} open accommodation change request{data.openChangeRequests !== 1 ? 's' : ''} awaiting review.</span>
          <button className="ml-auto font-medium underline" onClick={() => navigate('/accommodations')}>Review</button>
        </div>
      ) : null}
    </div>
  )
}
