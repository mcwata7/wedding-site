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
  invitation_id?: string
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
  relationship_group?: string
  email?: string
  phone?: string
  dietary_requirements?: string
  accessibility_needs?: string
  travel_origin?: string
  flight_number?: string
  planner_notes?: string
  is_additional_guest: boolean
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
  pricing?: string
  capacity?: number
  food_score?: number
  view_score?: number
  notes?: string
  archived: boolean
}

export interface Rsvp {
  id: string
  guest_id: string
  event_id: string
  first_name: string
  last_name: string
  party_name: string
  event_name: string
  status: 'ATTENDING' | 'DECLINED' | 'PENDING' | 'WAITLISTED'
  note?: string
  source?: string
  updated_at: string
}

export interface AccommodationProperty {
  id: string
  name: string
  address?: string
  contact_information?: string
  notes?: string
  archived: boolean
}

export interface AccommodationRoom {
  id: string
  property_id: string
  property_name: string
  room_number: string
  room_type?: string
  capacity: number
  archived: boolean
}

export interface AccommodationAssignment {
  id: string
  room_id: string
  room_number: string
  property_name: string
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

export interface BudgetCategory {
  id: string
  name: string
  archived: boolean
}

export interface BudgetContributor {
  id: string
  name: string
  archived: boolean
}

export interface BudgetLineItem {
  id: string
  category_id: string
  category_name: string
  description: string
  currency: string
  planned_amount?: number
  actual_amount?: number
  payment_status?: string
  due_date?: string
  notes?: string
  archived: boolean
}

export interface BudgetSummary {
  category: string
  currency: string
  planned_amount: number
  actual_amount: number
}

export interface ImportResult {
  partiesCreated: number
  guestsCreated: number
}

export interface SiteSettings {
  id: string
  partner_one_name: string
  partner_two_name: string
  wedding_date?: string
  display_timezone: string
  hero_image_id?: string
  hero_tagline?: string
  home_heading?: string
  home_body?: string
  travel_heading?: string
  travel_body?: string
  things_to_do_heading?: string
  things_to_do_body?: string
  schedule_heading?: string
  schedule_body?: string
  invitation_image_id?: string
  invitation_headline?: string
  invitation_body?: string
  invitation_footer?: string
  updated_at: string
}

export interface SitePage {
  id: string
  slug: string
  label: string
  sort_order: number
  visible: boolean
  body?: string
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
