import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type { SiteConfig, ScheduleEvent, ThingToDoItem } from './types'

const BASE = '/api/v1/guest/site'

export function siteMediaUrl(id?: string | null): string | undefined {
  return id ? `/api/v1/media/${id}` : undefined
}

export function useSiteConfig() {
  return useQuery({ queryKey: ['site-config'], queryFn: () => api.get<SiteConfig>(`${BASE}/config`) })
}

export function useSchedule() {
  return useQuery({ queryKey: ['site-schedule'], queryFn: () => api.get<ScheduleEvent[]>(`${BASE}/schedule`) })
}

export function useThingsToDo() {
  return useQuery({ queryKey: ['site-things-to-do'], queryFn: () => api.get<ThingToDoItem[]>(`${BASE}/things-to-do`) })
}
