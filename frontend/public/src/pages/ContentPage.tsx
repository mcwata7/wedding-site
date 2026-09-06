import { Navigate, useParams } from 'react-router-dom'
import { useSiteConfig, siteMediaUrl } from '../api/hooks'
import { LoadingSpinner, ErrorMessage, PageHeading, PageBanner } from '../components'
import { ApiRequestError } from '../api/client'

/** Renders any visible site_page without a dedicated page component (currently just RSVP)
 * with zero code changes — just heading + body text. Takes an optional `slug` so the
 * single-page composite can render a generic section (its slug already known from config)
 * without going through the route param this component also serves as `/:slug`. */
export function ContentPage({ slug: slugProp }: { slug?: string } = {}) {
  const { slug: routeSlug } = useParams<{ slug: string }>()
  const slug = slugProp ?? routeSlug
  const { data, isLoading, error } = useSiteConfig()

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error instanceof ApiRequestError ? error.message : 'Unable to load this page.'} />
  if (!data) return null

  const page = data.pages.find(p => p.slug === slug)
  if (!page) return <Navigate to="/" replace />

  return (
    <div>
      <PageBanner src={siteMediaUrl(page.image_id)} />
      <PageHeading title={page.heading || page.label} />
      {page.body ? (
        <p className="max-w-2xl mx-auto text-ink/80 whitespace-pre-line leading-relaxed">{page.body}</p>
      ) : (
        <p className="text-center text-ink/50">More details coming soon.</p>
      )}
    </div>
  )
}
