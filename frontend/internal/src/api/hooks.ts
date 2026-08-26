import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  Dashboard, Party, PartyDetail, Guest, Event, Venue, Rsvp,
  AccommodationProperty, AccommodationRoom, AccommodationAssignment,
  ChangeRequest, BudgetCategory, BudgetContributor, BudgetLineItem,
  BudgetSummary, ImportResult, SiteSettings, SitePage, ThingToDoItem, MediaAsset,
  InvitationCardRow,
} from './types'

const BASE = '/api/v1/internal'

// --- Dashboard ---
export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dashboard>(`${BASE}/dashboard`) })
}

// --- Parties ---
export function useParties(q?: string) {
  return useQuery({
    queryKey: ['parties', q],
    queryFn: () => api.get<Party[]>(`${BASE}/parties?size=100${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  })
}

export function useParty(id: string) {
  return useQuery({
    queryKey: ['parties', id],
    queryFn: () => api.get<{ party: PartyDetail; guests: Guest[] }>(`${BASE}/parties/${id}`),
    enabled: !!id,
  })
}

export function useCreateParty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Party>(`${BASE}/parties`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parties'] }),
  })
}

export function useUpdateResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ resource, id, body }: { resource: string; id: string; body: Record<string, unknown> }) =>
      api.patch(`${BASE}/resources/${resource}/${id}`, body),
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useArchiveResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ resource, id }: { resource: string; id: string }) =>
      api.post(`${BASE}/resources/${resource}/${id}/archive`),
    onSuccess: () => qc.invalidateQueries(),
  })
}

export function useCreateGuest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ partyId, body }: { partyId: string; body: Record<string, unknown> }) =>
      api.post<Guest>(`${BASE}/parties/${partyId}/guests`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parties'] }),
  })
}

export function useIssueQr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (partyId: string) => api.post<{ qrToken: string; expiresAt: string }>(`${BASE}/parties/${partyId}/invitations`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parties'] }),
  })
}

export function useRecordDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ invitationId, body }: { invitationId: string; body: { kind: string; note?: string } }) =>
      api.post(`${BASE}/invitations/${invitationId}/record-delivery`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parties'] }),
  })
}

export function useImportGuests() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.postForm<ImportResult>(`${BASE}/guests/import`, form)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parties'] }),
  })
}

// --- Events & Venues ---
export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: () => api.get<Event[]>(`${BASE}/events`) })
}

export function useVenues() {
  return useQuery({ queryKey: ['venues'], queryFn: () => api.get<Venue[]>(`${BASE}/venues`) })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Event>(`${BASE}/events`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useCreateVenue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Venue>(`${BASE}/venues`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues'] }),
  })
}

export function useAddEligibleParty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, partyId }: { eventId: string; partyId: string }) =>
      api.post(`${BASE}/events/${eventId}/eligible-parties/${partyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rsvps'] }),
  })
}

// --- RSVPs ---
export function useRsvps(eventId?: string) {
  return useQuery({
    queryKey: ['rsvps', eventId],
    queryFn: () => api.get<Rsvp[]>(`${BASE}/rsvps${eventId ? `?eventId=${eventId}` : ''}`),
  })
}

export function useUpdateRsvp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status: string; note?: string } }) =>
      api.put<Rsvp>(`${BASE}/rsvps/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rsvps'] }),
  })
}

// --- Accommodations ---
export function useProperties() {
  return useQuery({ queryKey: ['properties'], queryFn: () => api.get<AccommodationProperty[]>(`${BASE}/accommodations/properties`) })
}

export function useRooms() {
  return useQuery({ queryKey: ['rooms'], queryFn: () => api.get<AccommodationRoom[]>(`${BASE}/accommodations/rooms`) })
}

export function useAssignments() {
  return useQuery({ queryKey: ['assignments'], queryFn: () => api.get<AccommodationAssignment[]>(`${BASE}/accommodations/assignments`) })
}

export function useChangeRequests() {
  return useQuery({ queryKey: ['change-requests'], queryFn: () => api.get<ChangeRequest[]>(`${BASE}/accommodations/change-requests`) })
}

export function useCreateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<AccommodationProperty>(`${BASE}/accommodations/properties`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<AccommodationRoom>(`${BASE}/accommodations/rooms`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
  })
}

export function useCreateAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<AccommodationAssignment>(`${BASE}/accommodations/assignments`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  })
}

export function useResolveChangeRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'resolve' | 'decline' }) =>
      api.post(`${BASE}/accommodations/change-requests/${id}/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['change-requests'] }),
  })
}

// --- Budget ---
export function useBudgetCategories() {
  return useQuery({ queryKey: ['budget-categories'], queryFn: () => api.get<BudgetCategory[]>(`${BASE}/budget/categories`) })
}

export function useBudgetContributors() {
  return useQuery({ queryKey: ['budget-contributors'], queryFn: () => api.get<BudgetContributor[]>(`${BASE}/budget/contributors`) })
}

export function useBudgetLineItems() {
  return useQuery({ queryKey: ['budget-line-items'], queryFn: () => api.get<BudgetLineItem[]>(`${BASE}/budget/line-items`) })
}

export function useBudgetSummary() {
  return useQuery({ queryKey: ['budget-summary'], queryFn: () => api.get<BudgetSummary[]>(`${BASE}/budget/summary`) })
}

export function useCreateBudgetCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string }) => api.post<BudgetCategory>(`${BASE}/budget/categories`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-categories'] }),
  })
}

export function useCreateBudgetContributor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string }) => api.post<BudgetContributor>(`${BASE}/budget/contributors`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-contributors'] }),
  })
}

export function useCreateBudgetLineItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<BudgetLineItem>(`${BASE}/budget/line-items`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budget-line-items'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

// --- Wedding Site ---
export function useSiteSettings() {
  return useQuery({ queryKey: ['site-settings'], queryFn: () => api.get<SiteSettings>(`${BASE}/site/settings`) })
}

export function useUpdateSiteSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch<SiteSettings>(`${BASE}/site/settings`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['site-settings'] }),
  })
}

export function useSitePages() {
  return useQuery({ queryKey: ['site-pages'], queryFn: () => api.get<SitePage[]>(`${BASE}/site/pages`) })
}

export function useThingsToDoItems() {
  return useQuery({ queryKey: ['things-to-do-items'], queryFn: () => api.get<ThingToDoItem[]>(`${BASE}/site/things-to-do-items`) })
}

export function useCreateThingToDoItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<ThingToDoItem>(`${BASE}/site/things-to-do-items`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['things-to-do-items'] }),
  })
}

export function useMediaAssets() {
  return useQuery({ queryKey: ['media'], queryFn: () => api.get<MediaAsset[]>(`${BASE}/media`) })
}

export function useUploadMedia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.postForm<MediaAsset>(`${BASE}/media`, form)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  })
}

// --- Invitation Cards ---
export function useInvitationCards() {
  return useQuery({ queryKey: ['invitation-cards'], queryFn: () => api.get<InvitationCardRow[]>(`${BASE}/invitations`) })
}

export function useIssueMissingInvitations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ issued: number }>(`${BASE}/invitation-cards/issue-missing`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitation-cards'] })
      qc.invalidateQueries({ queryKey: ['parties'] })
    },
  })
}
