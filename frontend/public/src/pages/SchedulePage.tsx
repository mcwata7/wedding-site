import { useSiteConfig, usePageContent, useSchedule, siteMediaUrl } from '../api/hooks'
import { LoadingSpinner, ErrorMessage, PageHeading, PageBanner } from '../components'
import { ApiRequestError } from '../api/client'
import { fmtDate, fmtTime } from '../lib/format'

export function SchedulePage() {
  const config = useSiteConfig()
  const schedule = useSchedule()
  const page = usePageContent('schedule')

  if (config.isLoading || schedule.isLoading) return <LoadingSpinner />
  const err = config.error ?? schedule.error
  if (err) return <ErrorMessage message={err instanceof ApiRequestError ? err.message : 'Unable to load the schedule.'} />
  if (!config.data) return null

  const { settings } = config.data
  const events = schedule.data ?? []

  return (
    <div>
      <PageBanner src={siteMediaUrl(page?.image_id)} />
      <PageHeading eyebrow="Join Us" title={page?.heading || 'Schedule'} />
      {page?.body && (
        <p className="max-w-xl mx-auto text-center text-ink/70 mb-10">{page.body}</p>
      )}

      {events.length === 0 ? (
        <p className="text-center text-ink/50">The schedule will be posted here soon.</p>
      ) : (
        <ol className="max-w-2xl mx-auto space-y-6">
          {events.map(e => (
            <li key={e.id} className="bg-tileBg rounded-lg border border-tileBorder/10 p-6">
              <p className="text-xs tracking-[0.15em] uppercase text-accent mb-1">
                {fmtDate(e.starts_at, settings.display_timezone)}
              </p>
              <h3 className="font-display text-xl text-ink mb-2">{e.name}</h3>
              <p className="text-sm text-ink/70 mb-3">
                {fmtTime(e.starts_at, settings.display_timezone)}
                {e.ends_at ? ` – ${fmtTime(e.ends_at, settings.display_timezone)}` : ''}
              </p>
              {(e.venue_name || e.venue_address) && (
                <p className="text-sm text-ink/70">
                  {e.venue_name}
                  {e.venue_name && e.venue_address ? ' — ' : ''}
                  {e.venue_address}
                </p>
              )}
              {e.dress_code && <p className="text-sm text-ink/60 mt-1">Attire: {e.dress_code}</p>}
              {e.description && <p className="text-sm text-ink/70 mt-3 whitespace-pre-line">{e.description}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
