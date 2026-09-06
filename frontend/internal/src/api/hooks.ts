import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  Dashboard, Party, PartyDetail, Guest, Event, Venue, VenueRoom, VenueRoomWithVenue, VenueFee, Rsvp,
  AccommodationAssignment,
  ChangeRequest, ImportResult, SiteSettings, SitePage, ThingToDoItem, FaqItem, TravelHotel, TravelFlight, MediaAsset,
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
    queryFn: () => api.get<{ party: PartyDetail; guests: Guest[]; events: Event[]; rsvps: Rsvp[] }>(`${BASE}/parties/${id}`),
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

/** ADMIN-only: clear a party's guest-login lock after too many wrong verification answers. */
export function useUnlockPartyLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (partyId: string) => api.post(`${BASE}/parties/${partyId}/unlock`),
    onSuccess: (_d, partyId) => qc.invalidateQueries({ queryKey: ['parties', partyId] }),
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

export function useVenue(id: string) {
  return useQuery({
    queryKey: ['venues', id],
    queryFn: () => api.get<{ venue: Venue; rooms: VenueRoom[]; fees: VenueFee[] }>(`${BASE}/venues/${id}`),
    enabled: !!id,
  })
}

export function useCreateVenueRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<VenueRoom>(`${BASE}/venues/rooms`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues'] })
      qc.invalidateQueries({ queryKey: ['venue-rooms-flat'] })
    },
  })
}

export function useCreateVenueFee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<VenueFee>(`${BASE}/venues/fees`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues'] }),
  })
}

/** Flat, cross-venue room list -- backs the Assignment room picker and the guest
 * room-assignment dropdown, both of which need a room's venue without opening that venue. */
export function useAllVenueRooms() {
  return useQuery({ queryKey: ['venue-rooms-flat'], queryFn: () => api.get<VenueRoomWithVenue[]>(`${BASE}/venues/rooms`) })
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

// --- RSVPs ---
export function useUpdateRsvp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status: string; note?: string } }) =>
      api.put<Rsvp>(`${BASE}/rsvps/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rsvps'] })
      qc.invalidateQueries({ queryKey: ['parties'] })
    },
  })
}

// --- Accommodations ---
export function useAssignments() {
  return useQuery({ queryKey: ['assignments'], queryFn: () => api.get<AccommodationAssignment[]>(`${BASE}/accommodations/assignments`) })
}

export function useChangeRequests() {
  return useQuery({ queryKey: ['change-requests'], queryFn: () => api.get<ChangeRequest[]>(`${BASE}/accommodations/change-requests`) })
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

export function useFaqItems() {
  return useQuery({ queryKey: ['faq-items'], queryFn: () => api.get<FaqItem[]>(`${BASE}/site/faq-items`) })
}

export function useCreateFaqItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<FaqItem>(`${BASE}/site/faq-items`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['faq-items'] }),
  })
}

export function useTravelHotels() {
  return useQuery({ queryKey: ['travel-hotels'], queryFn: () => api.get<TravelHotel[]>(`${BASE}/site/travel-hotels`) })
}

export function useCreateTravelHotel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<TravelHotel>(`${BASE}/site/travel-hotels`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['travel-hotels'] }),
  })
}

export function useTravelFlights() {
  return useQuery({ queryKey: ['travel-flights'], queryFn: () => api.get<TravelFlight[]>(`${BASE}/site/travel-flights`) })
}

export function useCreateTravelFlight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<TravelFlight>(`${BASE}/site/travel-flights`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['travel-flights'] }),
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

export function usePreviewInvitationCard() {
  return useMutation({
    mutationFn: ({ side, ...candidate }: Record<string, unknown> & { side: 'FRONT' | 'BACK' }) =>
      api.postBlob(`${BASE}/invitation-cards/preview.pdf?side=${side}`, candidate),
  })
}
