import { useSiteConfig, usePageContent, siteMediaUrl } from '../api/hooks'
import { LoadingSpinner, ErrorMessage } from '../components'
import { ApiRequestError } from '../api/client'
import { fmtDateRange } from '../lib/format'

export function HomePage() {
  const { data, isLoading, error } = useSiteConfig()
  const page = usePageContent('home')

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error instanceof ApiRequestError ? error.message : 'Unable to load this page.'} />
  if (!data) return null

  const { settings } = data

  // A planner-designed image that replaces the entire Home page. All other fields (hero, tagline,
  // heading/body, partner names/date) stay editable and stored -- just not rendered -- while this
  // is on; if the flag is set but no image has been uploaded yet, fall through to the normal
  // composition below instead of showing a blank page. No object-cover/fixed height (unlike the
  // hero) since this is a purpose-built design meant to render at its own natural aspect ratio.
  if (settings.home_design_only && settings.home_design_image_id) {
    // The bleed margins live on this wrapper, not the <img> itself: a block box with an explicit
    // width (w-full) sizes against its containing block's content box regardless of margins, so
    // -mx-4 on the same element as w-full only shifts the box left without growing it to
    // compensate on the right -- leaving the image short by exactly 2x the removed padding, all
    // of it stranded on the right edge. A wrapper with no explicit width doesn't have that
    // conflict: `width: auto` solves against the negative margins and stretches to fill evenly on
    // both sides at any viewport width, the same pattern the hero image below already uses.
    return (
      <div className="-mx-4 -mt-8 sm:mx-0 sm:mt-0 sm:rounded-lg overflow-hidden">
        <img
          src={siteMediaUrl(settings.home_design_image_id)}
          alt={page?.heading || `${settings.partner_one_name || 'The'} & ${settings.partner_two_name || 'Couple'}`}
          className="w-full h-auto"
        />
      </div>
    )
  }

  const hero = siteMediaUrl(settings.hero_image_id)

  return (
    <div>
      <div className="relative -mx-4 -mt-8 sm:mx-0 sm:mt-0 sm:rounded-lg overflow-hidden mb-10">
        {hero ? (
          <img src={hero} alt="" className="w-full h-[60vh] min-h-[320px] object-cover" />
        ) : (
          <div className="w-full h-[50vh] min-h-[280px] temple-backdrop" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-maroon/20 via-maroon/10 to-maroon/40 flex flex-col items-center justify-center text-center px-4">
          <p className="font-display text-4xl sm:text-5xl text-white drop-shadow-sm">
            {settings.partner_one_name || 'The'} &amp; {settings.partner_two_name || 'Couple'}
          </p>
          {settings.wedding_start_date && (
            <p className="mt-3 text-white/90 text-sm tracking-[0.2em] uppercase">
              {fmtDateRange(settings.wedding_start_date, settings.wedding_end_date, settings.display_timezone)}
            </p>
          )}
        </div>
      </div>

      {settings.hero_tagline && (
        <div className="text-center mb-10">
          <p className="text-lg font-display text-ink/80 italic">{settings.hero_tagline}</p>
          <div className="temple-divider mt-4 text-xs" />
        </div>
      )}

      {(page?.heading || page?.body) && (
        <div className="max-w-2xl mx-auto text-center">
          {page.heading && <h2 className="font-display text-2xl text-ink mb-4">{page.heading}</h2>}
          {page.body && <p className="text-ink/80 whitespace-pre-line leading-relaxed">{page.body}</p>}
        </div>
      )}
    </div>
  )
}
