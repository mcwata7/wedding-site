import { useSiteConfig, usePageContent, useTravelInfo, siteMediaUrl } from '../api/hooks'
import { LoadingSpinner, ErrorMessage, PageHeading, PageBanner } from '../components'
import { ApiRequestError } from '../api/client'
import type { TravelHotel, TravelFlight } from '../api/types'

export function TravelPage() {
  const config = useSiteConfig()
  const travel = useTravelInfo()
  const page = usePageContent('travel')

  if (config.isLoading || travel.isLoading) return <LoadingSpinner />
  const err = config.error ?? travel.error
  if (err) return <ErrorMessage message={err instanceof ApiRequestError ? err.message : 'Unable to load travel info.'} />
  if (!config.data) return null

  const hotels = travel.data?.hotels ?? []
  const flights = travel.data?.flights ?? []

  return (
    <div>
      <PageBanner src={siteMediaUrl(page?.image_id)} />
      <PageHeading eyebrow="Plan Your Trip" title={page?.heading || 'Travel'} />
      {page?.body ? (
        <p className="max-w-2xl mx-auto text-ink/80 whitespace-pre-line leading-relaxed mb-10">{page.body}</p>
      ) : (
        !hotels.length && !flights.length && <p className="text-center text-ink/50">Travel details will be posted here soon.</p>
      )}

      {hotels.length > 0 && (
        <section className="max-w-2xl mx-auto mb-10">
          <h2 className="font-display text-xl text-ink mb-4">Hotels</h2>
          <div className="space-y-4">
            {hotels.map(h => <HotelCard key={h.id} hotel={h} />)}
          </div>
        </section>
      )}

      {flights.length > 0 && (
        <section className="max-w-2xl mx-auto">
          <h2 className="font-display text-xl text-ink mb-4">Flights</h2>
          <div className="space-y-4">
            {flights.map(f => <FlightCard key={f.id} flight={f} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function HotelCard({ hotel }: { hotel: TravelHotel }) {
  return (
    <div className="bg-tileBg rounded-lg border border-tileBorder/10 p-5">
      <h3 className="font-display text-lg text-ink mb-1">{hotel.name}</h3>
      {hotel.address && <p className="text-sm text-ink/70">{hotel.address}</p>}
      {hotel.description && <p className="text-sm text-ink/70 mt-2 whitespace-pre-line">{hotel.description}</p>}
      {hotel.url && (
        <a href={hotel.url} target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm text-accent hover:underline">
          Visit website
        </a>
      )}
    </div>
  )
}

function FlightCard({ flight }: { flight: TravelFlight }) {
  return (
    <div className="bg-tileBg rounded-lg border border-tileBorder/10 p-5">
      <h3 className="font-display text-lg text-ink mb-1">{flight.route_name}</h3>
      {(flight.duration || flight.estimated_cost) && (
        <p className="text-sm text-ink/70">
          {flight.duration}
          {flight.duration && flight.estimated_cost ? ' — ' : ''}
          {flight.estimated_cost}
        </p>
      )}
      {flight.description && <p className="text-sm text-ink/70 mt-2 whitespace-pre-line">{flight.description}</p>}
    </div>
  )
}
