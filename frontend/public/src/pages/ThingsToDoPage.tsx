import { useSiteConfig, usePageContent, useThingsToDo, siteMediaUrl } from '../api/hooks'
import { LoadingSpinner, ErrorMessage, PageHeading, PageBanner } from '../components'
import { ApiRequestError } from '../api/client'
import type { ThingToDoItem } from '../api/types'

export function ThingsToDoPage() {
  const config = useSiteConfig()
  const thingsToDo = useThingsToDo()
  const page = usePageContent('things-to-do')

  if (config.isLoading || thingsToDo.isLoading) return <LoadingSpinner />
  const err = config.error ?? thingsToDo.error
  if (err) return <ErrorMessage message={err instanceof ApiRequestError ? err.message : 'Unable to load things to do.'} />
  if (!config.data) return null

  const items = thingsToDo.data ?? []
  const categories = [...new Set(items.map(i => i.category))]

  return (
    <div>
      <PageBanner src={siteMediaUrl(page?.image_id)} />
      <PageHeading eyebrow="Explore" title={page?.heading || 'Things To Do'} />
      {page?.body && (
        <p className="max-w-xl mx-auto text-center text-ink/70 whitespace-pre-line mb-10">{page.body}</p>
      )}

      {items.length === 0 ? (
        <p className="text-center text-ink/50">Recommendations will be posted here soon.</p>
      ) : (
        <div className="max-w-3xl mx-auto space-y-10">
          {categories.map(category => (
            <section key={category}>
              <h2 className="font-display text-xl text-ink mb-4">{category}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {items.filter(i => i.category === category).map(item => <ThingToDoCard key={item.id} item={item} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function ThingToDoCard({ item }: { item: ThingToDoItem }) {
  const image = siteMediaUrl(item.image_id)
  return (
    <div className="bg-tileBg rounded-lg border border-tileBorder/10 overflow-hidden">
      {image && <img src={image} alt="" className="w-full h-40 object-cover" />}
      <div className="p-5">
        <h3 className="font-display text-lg text-ink mb-1">{item.title}</h3>
        {item.description && <p className="text-sm text-ink/70 mt-2 whitespace-pre-line">{item.description}</p>}
      </div>
    </div>
  )
}
