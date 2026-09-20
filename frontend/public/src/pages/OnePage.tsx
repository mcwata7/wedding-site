import { Fragment } from 'react'
import { useSiteConfig, useSchedule, useTravelInfo, useThingsToDo, useFaq, useSectionPages } from '../api/hooks'
import { LoadingSpinner, ErrorMessage, Section, SectionOrnament } from '../components'
import { ApiRequestError } from '../api/client'
import { useHashScroll } from '../lib/scroll'
import { HomePage } from './HomePage'
import { SchedulePage } from './SchedulePage'
import { TravelPage } from './TravelPage'
import { ThingsToDoPage } from './ThingsToDoPage'
import { FaqPage } from './FaqPage'
import { ContentPage } from './ContentPage'

const SECTION_COMPONENTS: Record<string, () => JSX.Element | null> = {
  home: HomePage,
  schedule: SchedulePage,
  travel: TravelPage,
  'things-to-do': ThingsToDoPage,
  faq: FaqPage,
}

/** Single-page layout: every visible page except RSVP (see ROUTED_SLUGS) rendered in one
 * document as anchored <Section>s, in the planner's sort_order, instead of one route each. Each
 * page component is reused exactly as-is -- same hooks, same loading/error handling -- so the
 * two layouts can never drift apart as content evolves. */
export function OnePage() {
  const config = useSiteConfig()
  const sections = useSectionPages()

  // Every list hook is called unconditionally (rules of hooks); which ones actually gate
  // isLoading below depends on which pages are visible. This costs one small extra request for
  // a hidden tab's data, which is cheap next to giving every page component its own signature.
  const schedule = useSchedule()
  const travel = useTravelInfo()
  const thingsToDo = useThingsToDo()
  const faq = useFaq()
  const queryFor: Record<string, { isLoading: boolean }> = {
    schedule, travel, 'things-to-do': thingsToDo, faq,
  }

  const isLoading = config.isLoading || sections.some(p => queryFor[p.slug]?.isLoading)
  useHashScroll(!isLoading)

  if (isLoading) return <LoadingSpinner />
  if (config.error) return <ErrorMessage message={config.error instanceof ApiRequestError ? config.error.message : 'Unable to load this page.'} />
  if (!config.data) return null

  return (
    <div>
      {sections.map((page, i) => {
        const Component = SECTION_COMPONENTS[page.slug]
        return (
          <Fragment key={page.slug}>
            {/* No margin on Section itself -- the first section (typically Home) relies on
             * sitting flush at the top for its hero's negative margins to line up. */}
            {i > 0 && (
              <div className="my-16">
                <div className="temple-divider text-xs" />
                <SectionOrnament index={i - 1} />
              </div>
            )}
            <Section id={page.slug}>
              {Component ? <Component /> : <ContentPage slug={page.slug} />}
            </Section>
          </Fragment>
        )
      })}
    </div>
  )
}
