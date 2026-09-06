import { useSiteConfig, usePageContent, useFaq, siteMediaUrl } from '../api/hooks'
import { LoadingSpinner, ErrorMessage, PageHeading, PageBanner } from '../components'
import { ApiRequestError } from '../api/client'

export function FaqPage() {
  const config = useSiteConfig()
  const faq = useFaq()
  const page = usePageContent('faq')

  if (config.isLoading || faq.isLoading) return <LoadingSpinner />
  const err = config.error ?? faq.error
  if (err) return <ErrorMessage message={err instanceof ApiRequestError ? err.message : 'Unable to load the FAQ.'} />
  if (!config.data) return null

  const items = faq.data ?? []

  return (
    <div>
      <PageBanner src={siteMediaUrl(page?.image_id)} />
      <PageHeading eyebrow="Good to Know" title={page?.heading || 'FAQ'} />
      {page?.body && (
        <p className="max-w-2xl mx-auto text-center text-ink/70 whitespace-pre-line mb-10">{page.body}</p>
      )}

      {items.length === 0 ? (
        <p className="text-center text-ink/50">Answers will be posted here soon.</p>
      ) : (
        <div className="max-w-2xl mx-auto space-y-4">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-lg border border-ink/10 p-5">
              <h3 className="font-display text-lg text-ink mb-2">{item.question}</h3>
              {item.answer && <p className="text-sm text-ink/70 whitespace-pre-line">{item.answer}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
