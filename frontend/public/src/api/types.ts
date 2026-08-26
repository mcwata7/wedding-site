export interface ApiError {
  code: string
  message: string
  requestId?: string
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
}

export interface SitePage {
  slug: string
  label: string
  sort_order: number
  body?: string
}

export interface SiteConfig {
  settings: SiteSettings
  pages: SitePage[]
}

export interface ScheduleEvent {
  id: string
  name: string
  description?: string
  starts_at: string
  ends_at?: string
  dress_code?: string
  venue_name?: string
  venue_address?: string
}

export interface ThingToDoItem {
  id: string
  category: string
  title: string
  description?: string
  image_id?: string
  sort_order: number
}

export interface InviteLookup {
  partyName: string
  verificationQuestion: string
}

export interface GuestSession {
  accessToken: string
  tokenType: string
}
