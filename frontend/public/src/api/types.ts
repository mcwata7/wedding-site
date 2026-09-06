export interface ApiError {
  code: string
  message: string
  requestId?: string
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
  site_layout?: 'MULTI_PAGE' | 'SINGLE_PAGE'
  // Site-wide styling -- keys mirrored in frontend/internal/src/api/types.ts and validated
  // against InternalDataController.java's SITE_FONTS/FONT_SIZES sets. null/undefined means
  // "use the guest app's built-in look" (src/lib/theme.ts).
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
}

export interface SitePage {
  slug: string
  label: string
  heading?: string
  sort_order: number
  body?: string
  image_id?: string
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

export interface FaqItem {
  id: string
  question: string
  answer?: string
  sort_order: number
}

export interface TravelHotel {
  id: string
  name: string
  address?: string
  url?: string
  description?: string
  sort_order: number
}

export interface TravelFlight {
  id: string
  route_name: string
  duration?: string
  estimated_cost?: string
  description?: string
  sort_order: number
}

export interface TravelInfo {
  hotels: TravelHotel[]
  flights: TravelFlight[]
}

export interface InviteLookup {
  partyName: string
  verificationQuestion: string
}

export interface GuestSession {
  accessToken: string
  tokenType: string
}
