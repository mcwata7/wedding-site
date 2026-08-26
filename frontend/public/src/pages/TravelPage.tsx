import { useSiteConfig } from '../api/hooks'
import { LoadingSpinner, ErrorMessage, PageHeading } from '../components'
import { ApiRequestError } from '../api/client'

export function TravelPage() {
  const config = useSiteConfig()

  if (config.isLoading) return <LoadingSpinner />
  if (config.error) return <ErrorMessage message={config.error instanceof ApiRequestError ? config.error.message : 'Unable to load travel info.'} />
  if (!config.data) return null

  const { settings } = config.data

  return (
    <div>
      <PageHeading eyebrow="Plan Your Trip" title={settings.travel_heading || 'Travel'} />
      {settings.travel_body ? (
        <p className="max-w-2xl mx-auto text-ink/80 whitespace-pre-line leading-relaxed">{settings.travel_body}</p>
      ) : (
        <p className="text-center text-ink/50">Travel details will be posted here soon.</p>
      )}
    </div>
  )
}
