import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { siteMediaUrl, useSiteConfig } from '../api/hooks'
import { useGuestAuth } from './GuestAuthContext'
import { LoadingSpinner } from '../components'
import { useSiteTheme } from '../lib/theme'

/** Keep the requested route/hash intact while showing the card before other prompts. */
export function SaveTheDateGate({ children }: { children: React.ReactNode }) {
  const { saveTheDateDismissed, dismissSaveTheDate } = useGuestAuth()
  const { data, isPending, error } = useSiteConfig()
  const location = useLocation()
  if (saveTheDateDismissed) return <>{children}</>
  if (isPending) return <LoadingSpinner />
  const settings = data?.settings
  if (!error && (!settings?.save_the_date_enabled || !settings.save_the_date_image_id)) return <>{children}</>
  return <SaveTheDateCard key={settings?.save_the_date_image_id ?? 'error'} src={error ? undefined : siteMediaUrl(settings?.save_the_date_image_id)} href={location.pathname + location.search + location.hash} onContinue={dismissSaveTheDate} />
}

function SaveTheDateCard({ src, href, onContinue }: { src?: string; href: string; onContinue: () => void }) {
  // This screen precedes Layout, so apply the site font here as well.
  useSiteTheme()
  const heading = useRef<HTMLHeadingElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { heading.current?.focus() }, [])
  return (
    <main className="min-h-screen min-h-[100svh] bg-paper flex flex-col items-center justify-center gap-6 px-4 py-8">
      <h1 ref={heading} tabIndex={-1} className="sr-only">Save the Date</h1>
      {src && !failed ? (
        <div className="flex justify-center w-full">
          <img src={src} alt="Save the Date invitation" onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
            className={`save-the-date-card w-auto h-auto max-w-full max-h-[calc(100svh-9rem)] object-contain shadow-xl ${loaded ? 'save-the-date-card-ready' : 'opacity-0'}`} />
          {!loaded && <span role="status" className="sr-only">Loading your Save the Date card…</span>}
        </div>
      ) : <p role="status" className="text-center text-ink">The Save the Date card is unavailable. You can still continue to the site.</p>}
      <a href={href} onClick={e => { e.preventDefault(); onContinue() }} className="font-display text-accent underline underline-offset-4 px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Continue to the site</a>
    </main>
  )
}
