import { useSiteConfig, siteMediaUrl } from '../api/hooks'
import { LoadingSpinner, ErrorMessage } from '../components'
import { ApiRequestError } from '../api/client'
import { fmtDate } from '../lib/format'

export function HomePage() {
  const { data, isLoading, error } = useSiteConfig()

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error instanceof ApiRequestError ? error.message : 'Unable to load this page.'} />
  if (!data) return null

  const { settings } = data
  const hero = siteMediaUrl(settings.hero_image_id)

  return (
    <div>
      <div className="relative -mx-4 -mt-8 sm:mx-0 sm:mt-0 sm:rounded-lg overflow-hidden mb-10">
        {hero ? (
          <img src={hero} alt="" className="w-full h-[60vh] min-h-[320px] object-cover" />
        ) : (
          <div className="w-full h-[40vh] min-h-[240px] bg-accent/10" />
        )}
        <div className="absolute inset-0 bg-black/25 flex flex-col items-center justify-center text-center px-4">
          <p className="font-display text-4xl sm:text-5xl text-white drop-shadow-sm">
            {settings.partner_one_name || 'The'} &amp; {settings.partner_two_name || 'Couple'}
          </p>
          {settings.wedding_date && (
            <p className="mt-3 text-white/90 text-sm tracking-[0.15em] uppercase">
              {fmtDate(settings.wedding_date, settings.display_timezone)}
            </p>
          )}
        </div>
      </div>

      {settings.hero_tagline && (
        <p className="text-center text-lg font-display text-ink/80 mb-10">{settings.hero_tagline}</p>
      )}

      {(settings.home_heading || settings.home_body) && (
        <div className="max-w-2xl mx-auto text-center">
          {settings.home_heading && <h2 className="font-display text-2xl text-ink mb-4">{settings.home_heading}</h2>}
          {settings.home_body && <p className="text-ink/80 whitespace-pre-line leading-relaxed">{settings.home_body}</p>}
        </div>
      )}
    </div>
  )
}
