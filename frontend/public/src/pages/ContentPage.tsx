import { Navigate, useParams } from 'react-router-dom'
import { useSiteConfig } from '../api/hooks'
import { LoadingSpinner, ErrorMessage, PageHeading } from '../components'
import { ApiRequestError } from '../api/client'

/** Renders any visible site_page beyond Home/Schedule/Travel/Things To Do (e.g. FAQ once the
 * planner flips it on) with zero code changes — just heading + body text. */
export function ContentPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data, isLoading, error } = useSiteConfig()

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error instanceof ApiRequestError ? error.message : 'Unable to load this page.'} />
  if (!data) return null

  const page = data.pages.find(p => p.slug === slug)
  if (!page) return <Navigate to="/" replace />

  return (
    <div>
      <PageHeading title={page.label} />
      {page.body ? (
        <p className="max-w-2xl mx-auto text-ink/80 whitespace-pre-line leading-relaxed">{page.body}</p>
      ) : (
        <p className="text-center text-ink/50">More details coming soon.</p>
      )}
    </div>
  )
}
