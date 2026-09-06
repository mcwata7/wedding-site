import { useQuery } from '@tanstack/react-query'
import { api, API_BASE_URL } from './client'
import type { SiteConfig, SitePage, ScheduleEvent, ThingToDoItem, FaqItem, TravelInfo } from './types'

const BASE = '/api/v1/guest/site'

export function siteMediaUrl(id?: string | null): string | undefined {
  return id ? `${API_BASE_URL}/api/v1/media/${id}` : undefined
}

export function useSiteConfig() {
  return useQuery({ queryKey: ['site-config'], queryFn: () => api.get<SiteConfig>(`${BASE}/config`) })
}

/** Looks up a single site_page's heading/body/image by slug from the shared site config --
 * every dedicated page (Home, Schedule, Travel, Things To Do, FAQ) reads its own copy this way. */
export function usePageContent(slug: string): SitePage | undefined {
  const { data } = useSiteConfig()
  return data?.pages.find(p => p.slug === slug)
}

/** Slugs that always get their own route regardless of site_layout -- currently just RSVP,
 * since it's the one page guests submit through rather than just read, and a form mid-scroll
 * fights the anchor/section model the rest of the site uses in single-page mode. */
export const ROUTED_SLUGS = new Set(['rsvp'])

/** Anything !== 'SINGLE_PAGE' is treated as the default -- fail-safe to today's per-route
 * behavior if the setting is missing (a bundle built before this column existed, or an API
 * response that predates the migration). */
export function useSiteLayout(): 'MULTI_PAGE' | 'SINGLE_PAGE' {
  const { data } = useSiteConfig()
  return data?.settings.site_layout === 'SINGLE_PAGE' ? 'SINGLE_PAGE' : 'MULTI_PAGE'
}

/** The pages rendered as anchored sections in single-page mode -- every visible page except
 * the ones in ROUTED_SLUGS, already sorted by the config's sort_order. */
export function useSectionPages(): SitePage[] {
  const { data } = useSiteConfig()
  return (data?.pages ?? []).filter(p => !ROUTED_SLUGS.has(p.slug))
}

export function useSchedule() {
  return useQuery({ queryKey: ['site-schedule'], queryFn: () => api.get<ScheduleEvent[]>(`${BASE}/schedule`) })
}

export function useThingsToDo() {
  return useQuery({ queryKey: ['site-things-to-do'], queryFn: () => api.get<ThingToDoItem[]>(`${BASE}/things-to-do`) })
}

export function useFaq() {
  return useQuery({ queryKey: ['site-faq'], queryFn: () => api.get<FaqItem[]>(`${BASE}/faq`) })
}

export function useTravelInfo() {
  return useQuery({ queryKey: ['site-travel'], queryFn: () => api.get<TravelInfo>(`${BASE}/travel`) })
}
