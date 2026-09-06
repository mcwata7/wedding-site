const KTM = 'Asia/Kathmandu'

export function fmtDateTime(s?: string | null): string {
  if (!s) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: KTM,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(s))
}

export function fmtDate(s?: string | null): string {
  if (!s) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: KTM,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(s))
}

export function fmtMoney(amount?: number | null, currency = 'NPR'): string {
  if (amount == null) return '—'
  return `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

const STATUS_COLORS: Record<string, string> = {
  ATTENDING: 'bg-green-100 text-green-800',
  DECLINED: 'bg-red-100 text-red-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  WAITLISTED: 'bg-purple-100 text-purple-800',
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-800',
  VIEWED: 'bg-indigo-100 text-indigo-800',
  RESPONDED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-700',
  OPEN: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CERTAIN: 'bg-green-100 text-green-800',
  VERY_LIKELY: 'bg-green-100 text-green-800',
  LIKELY: 'bg-blue-100 text-blue-800',
  MAYBE: 'bg-yellow-100 text-yellow-800',
  UNLIKELY: 'bg-red-100 text-red-800',
}

export function statusColor(status?: string | null): string {
  return STATUS_COLORS[status ?? ''] ?? 'bg-gray-100 text-gray-700'
}
