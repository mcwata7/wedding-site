export function fmtDateTime(s: string | undefined | null, timeZone: string): string {
  if (!s) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(s))
}

export function fmtDate(s: string | undefined | null, timeZone: string): string {
  if (!s) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(s))
}

export function fmtDateRange(start: string | undefined | null, end: string | undefined | null, timeZone: string): string {
  if (!start) return ''
  if (!end || end === start) return fmtDate(start, timeZone)
  return `${fmtDate(start, timeZone)} – ${fmtDate(end, timeZone)}`
}

export function fmtTime(s: string | undefined | null, timeZone: string): string {
  if (!s) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(s))
}
