export interface ApiError {
  code: string
  message: string
  requestId?: string
}

export interface Dashboard {
  parties: number
  guests: number
  events: number
  attending: number
  pendingRsvps: number
  openChangeRequests: number
}

export interface Party {
  id: string
  display_name: string
  contact_email: string
  contact_phone: string
  archived: boolean
  created_at: string
}

export interface PartyDetail extends Party {
  login_locked_permanently?: boolean
  login_locked_until?: string
  login_failed_count?: number
  invitation_id?: string
  token?: string
  invitation_status?: string
  sent_at?: string
  viewed_at?: string
  token_expires_at?: string
  verification_question: string
}


export interface Guest {
  id: string
  party_id: string
  first_name: string
  last_name: string
  relationship_group?: 'FAMILY' | 'RELATIVE' | 'FRIEND' | 'OTHER'
  email?: string
  phone?: string
  dietary_requirements?: string
  accessibility_needs?: string
  travel_origin?: string
  flight_number?: string
  planner_notes?: string
  is_additional_guest: boolean
  wedding_side?: 'BRIDE' | 'GROOM'
  attendance_probability?: 'CERTAIN' | 'VERY_LIKELY' | 'LIKELY' | 'MAYBE' | 'UNLIKELY' | 'NA'
  is_wedding_party: boolean
  passport?: 'NEPALI' | 'INDIAN' | 'OTHER'
  is_ktm_resident: boolean
  is_child: boolean
  room_assignment_id?: string
  room_number?: string
  room_venue_name?: string
  invite_round?: number
  active: boolean
  created_at: string
}

export interface Event {
  id: string
  name: string
  description?: string
  venue_id?: string
  venue_name?: string
  starts_at: string
  ends_at?: string
  dress_code?: string
  capacity?: number
  rsvp_deadline?: string
  attending_count: number
  waitlist_count: number
  public_visible: boolean
  archived: boolean
}

export interface Venue {
  id: string
  name: string
  address?: string
  contact_information?: string
  capacity?: number
  notes?: string
  image_id?: string
  distance_from_ktm_km?: number
  transportation_required: boolean
  room_block_min?: number
  room_block_max?: number
  room_block_rooms?: number
  room_block_beds?: number
  total_fees?: number
  archived: boolean
}

export interface VenueRoom {
  id: string
  venue_id: string
  room_type?: string
  room_number?: string
  capacity?: number
  max_available?: number
  nepali_rate?: number
  foreigner_rate?: number
  notes?: string
  archived: boolean
}

/** The flat, cross-venue room list from GET /venues/rooms -- backs the Assignment room picker
 * and the guest room-assignment dropdown, both of which need to show which venue a room
 * belongs to without the caller having opened that venue's detail page. */
export interface VenueRoomWithVenue extends VenueRoom {
  venue_name: string
}

export interface VenueFee {
  id: string
  venue_id: string
  fee_type: 'SANGEET_DAY_CATERING' | 'WEDDING_LUNCH_CATERING' | 'WEDDING_DINNER_CATERING' | 'CORKAGE'
  amount?: number
  notes?: string
  archived: boolean
}

export interface Rsvp {
  id: string
  guest_id: string
  event_id: string
  party_id: string
  first_name: string
  last_name: string
  party_name?: string
  event_name?: string
  status: 'ATTENDING' | 'DECLINED' | 'PENDING' | 'WAITLISTED'
  note?: string
  source?: string
  created_at: string
  updated_at: string
}

export interface AccommodationAssignment {
  id: string
  room_id: string
  room_number: string
  venue_name: string
  party_id?: string
  guest_id?: string
  assignee: string
  check_in: string
  check_out: string
  status: string
  coverage_notes?: string
  override_capacity: boolean
}

export interface ChangeRequest {
  id: string
  assignment_id: string
  party_id: string
  party_name: string
  request_note: string
  status: 'OPEN' | 'RESOLVED' | 'DECLINED'
  created_at: string
}

export interface ImportResult {
  partiesCreated: number
  guestsCreated: number
}

export interface SiteSettings {
  id: string
  partner_one_name: string
  partner_two_name: string
  wedding_start_date?: string
  wedding_end_date?: string
  display_timezone: string
  hero_image_id?: string
  hero_tagline?: string
  invitation_front_image_id?: string
  invitation_back_image_id?: string
  invitation_orientation?: 'PORTRAIT' | 'LANDSCAPE'
  invitation_card_layout?: CardLayout
  site_layout?: 'MULTI_PAGE' | 'SINGLE_PAGE'
  // Site-wide styling -- keys mirrored in frontend/public/src/api/types.ts and validated against
  // InternalDataController.java's SITE_FONTS/FONT_SIZES sets (font family label options also
  // mirrored in SitePage.tsx's own FONT_FAMILIES). null/undefined means "use the guest app's
  // built-in look".
  header_font_family?: string
  header_font_color?: string
  header_font_size?: 'SMALL' | 'MEDIUM' | 'LARGE'
  header_bg_color?: string
  site_font_family?: string
  site_font_color?: string
  site_font_size?: 'SMALL' | 'MEDIUM' | 'LARGE'
  site_bg_color?: string
  tile_bg_color?: string
  tile_border_color?: string
  home_design_image_id?: string
  home_design_only?: boolean
  updated_at: string
}

export interface QrLayout {
  x: number
  y: number
  size: number
  color: string
}

/** No font -- font is fixed in code for both text elements (inviteUrl, guestNames). */
export interface TextLayout {
  x: number
  y: number
  size: number
  color: string
}

export interface CardLayout {
  qr: QrLayout
  inviteUrl: TextLayout
  guestNames: TextLayout
}

export interface SitePage {
  id: string
  slug: string
  label: string
  heading?: string
  sort_order: number
  visible: boolean
  body?: string
  image_id?: string
}

export interface ThingToDoItem {
  id: string
  category: string
  title: string
  description?: string
  image_id?: string
  sort_order: number
  archived: boolean
}

export interface FaqItem {
  id: string
  question: string
  answer?: string
  sort_order: number
  archived: boolean
}

export interface TravelHotel {
  id: string
  name: string
  address?: string
  url?: string
  description?: string
  sort_order: number
  archived: boolean
}

export interface TravelFlight {
  id: string
  route_name: string
  duration?: string
  estimated_cost?: string
  description?: string
  sort_order: number
  archived: boolean
}

export interface MediaAsset {
  id: string
  content_type: string
  size_bytes: number
  original_name?: string
  created_at: string
}

export interface InvitationCardRow {
  party_id: string
  display_name: string
  invitation_id?: string
  invitation_status?: string
  sent_at?: string
  token_expires_at?: string
  printable: boolean
}
