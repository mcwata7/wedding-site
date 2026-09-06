# Generated code map

Regenerate with `scripts/gen-context-map.sh`. Do not hand-edit — a Stop hook
(`scripts/check-context-fresh.sh`) diffs this file against a fresh run and
flags drift. For the *why* behind these, see `SYSTEM_DESIGN.md` and
`docs/DECISIONS.md`; this file is only the *what*, derived from code.

## Backend endpoints

| Controller | Mapping |
|---|---|
AuthController.java | @RestController Base("/api/v1")
AuthController.java | Post("/auth/planner/login") Map<String,Object> login(@Valid @RequestBody Login in)
AuthController.java | Post("/guest/invitations/lookup") Map<String,Object> lookup(@Valid @RequestBody InviteLookup in)
AuthController.java | Post("/guest/sessions") Map<String,Object> guest(@Valid @RequestBody GuestSession in)
GuestController.java | @RestController Base("/api/v1/guest")
GuestController.java | Get("/accommodation") List<Map<String,Object>> accommodations(@AuthenticationPrincipal Principal p)
GuestController.java | Get("/events") List<Map<String,Object>> events(@AuthenticationPrincipal Principal p)
GuestController.java | Get("/party") Map<String,Object> party(@AuthenticationPrincipal Principal p)
GuestController.java | Get("/rsvps") List<Map<String,Object>> rsvps(@AuthenticationPrincipal Principal p)
GuestController.java | Patch("/guests/{id}") Map<String,Object> updateGuest(@AuthenticationPrincipal Principal p,@PathVariable UUID id,@RequestBody GuestUpdate 
GuestController.java | Post("/accommodation/{id}/change-requests") Map<String,Object> request(@AuthenticationPrincipal Principal p,@PathVariable UUID id,@Valid 
GuestController.java | Put("/rsvps/{id}") Map<String,Object> rsvp(@AuthenticationPrincipal Principal p,@PathVariable UUID id,@Valid @RequestBody RsvpUpdate in) 
GuestImportController.java | @RestController Base("/api/v1/internal/guests")
GuestImportController.java | Get(value="/import-template.csv",produces="text/csv") ResponseEntity<String> template()
GuestImportController.java | Post(value="/import",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) Map<String,Object> importCsv(@AuthenticationPrincipal Principal 
InternalController.java | @RestController Base("/api/v1/internal")
InternalController.java | Get("/parties") List<Map<String,Object>> parties(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size,@R
InternalController.java | Post("/accommodations/assignments") ResponseEntity<Map<String,Object>> assignment(@AuthenticationPrincipal Principal p,@RequestBody Ma
InternalController.java | Post("/events") ResponseEntity<Map<String,Object>> event(@AuthenticationPrincipal Principal actor,@RequestBody Map<String,Object> in)
InternalController.java | Post("/invitations/{id}/record-delivery") Map<String,Object> delivery(@AuthenticationPrincipal Principal p,@PathVariable UUID id,@Vali
InternalController.java | Post("/parties") ResponseEntity<Map<String,Object>> party(@AuthenticationPrincipal Principal actor,@Valid @RequestBody PartyInput in)
InternalController.java | Post("/parties/{id}/invitations") Map<String,Object> invitation(@AuthenticationPrincipal Principal actor,@PathVariable UUID id,@Reques
InternalController.java | Post("/parties/{id}/unlock") Map<String,Object> unlockParty(@AuthenticationPrincipal Principal actor,@PathVariable UUID id)
InternalController.java | Post("/parties/{partyId}/guests") ResponseEntity<Map<String,Object>> guest(@AuthenticationPrincipal Principal actor,@PathVariable UUID
InternalController.java | Post("/site/faq-items") ResponseEntity<Map<String,Object>> faqItem(@AuthenticationPrincipal Principal p,@RequestBody Map<String,Object
InternalController.java | Post("/site/things-to-do-items") ResponseEntity<Map<String,Object>> thingToDoItem(@AuthenticationPrincipal Principal p,@RequestBody Ma
InternalController.java | Post("/site/travel-flights") ResponseEntity<Map<String,Object>> travelFlight(@AuthenticationPrincipal Principal p,@RequestBody Map<Str
InternalController.java | Post("/site/travel-hotels") ResponseEntity<Map<String,Object>> travelHotel(@AuthenticationPrincipal Principal p,@RequestBody Map<Strin
InternalController.java | Post("/venues") ResponseEntity<Map<String,Object>> venue(@AuthenticationPrincipal Principal p,@RequestBody Map<String,Object> in)
InternalController.java | Post("/venues/fees") ResponseEntity<Map<String,Object>> venueFee(@AuthenticationPrincipal Principal p,@RequestBody Map<String,Object> 
InternalController.java | Post("/venues/rooms") ResponseEntity<Map<String,Object>> venueRoom(@AuthenticationPrincipal Principal p,@RequestBody Map<String,Object
InternalController.java | Put("/rsvps/{id}") Map<String,Object> manualRsvp(@AuthenticationPrincipal Principal p,@PathVariable UUID id,@Valid @RequestBody Manual
InternalDataController.java | @RestController Base("/api/v1/internal")
InternalDataController.java | Get("/accommodations/assignments") List<Map<String,Object>> assignments()
InternalDataController.java | Get("/accommodations/change-requests") List<Map<String,Object>> requests()
InternalDataController.java | Get("/dashboard") Map<String,Object> dashboard()
InternalDataController.java | Get("/events") List<Map<String,Object>> events()
InternalDataController.java | Get("/invitations") List<Map<String,Object>> invitations()
InternalDataController.java | Get("/parties/{id}") Map<String,Object> party(@PathVariable UUID id)
InternalDataController.java | Get("/rsvps") List<Map<String,Object>> rsvps(@RequestParam(required=false) UUID eventId) { var ps=new org.springframework.jdbc.cor
InternalDataController.java | Get("/site/faq-items") List<Map<String,Object>> faqItems()
InternalDataController.java | Get("/site/pages") List<Map<String,Object>> sitePages()
InternalDataController.java | Get("/site/settings") Map<String,Object> siteSettings()
InternalDataController.java | Get("/site/things-to-do-items") List<Map<String,Object>> thingsToDoItems()
InternalDataController.java | Get("/site/travel-flights") List<Map<String,Object>> travelFlights()
InternalDataController.java | Get("/site/travel-hotels") List<Map<String,Object>> travelHotels()
InternalDataController.java | Get("/venues") List<Map<String,Object>> venues()
InternalDataController.java | Get("/venues/{id}") Map<String,Object> venue(@PathVariable UUID id)
InternalDataController.java | Get("/venues/rooms") List<Map<String,Object>> allVenueRooms()
InternalDataController.java | Patch("/resources/{resource}/{id}") Map<String,Object> update(@AuthenticationPrincipal Principal actor,@PathVariable String resour
InternalDataController.java | Patch("/site/settings") Map<String,Object> updateSiteSettings(@AuthenticationPrincipal Principal actor,@RequestBody Map<String,Obj
InternalDataController.java | Post("/accommodations/change-requests/{id}/{action}") Map<String,Object> resolve(@AuthenticationPrincipal Principal actor,@PathVar
InternalDataController.java | Post("/resources/{resource}/{id}/archive") Map<String,Object> archive(@AuthenticationPrincipal Principal actor,@PathVariable Strin
InvitationCardController.java | @RestController Base("/api/v1/internal")
InvitationCardController.java | Get("/invitation-cards.pdf")
InvitationCardController.java | Get("/parties/
InvitationCardController.java | Post("/invitation-cards/issue-missing")
InvitationCardController.java | Post("/invitation-cards/preview.pdf")
MediaController.java | @RestController Base("/api/v1")
MediaController.java | Get("/internal/media") List<Map<String,Object>> list()
MediaController.java | Get("/media/{id}") ResponseEntity<byte[]> read(@PathVariable UUID id)
MediaController.java | Post(value = "/internal/media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
ReportController.java | @RestController Base("/api/v1/internal/reports")
ReportController.java | Get(value="/attendance.csv",produces="text/csv") ResponseEntity<String> attendance(@RequestParam(required=false) UUID eventId)
ReportController.java | Get(value="/dietary.csv",produces="text/csv") ResponseEntity<String> dietary()
ReportController.java | Get(value="/guest-list.csv",produces="text/csv") ResponseEntity<String> guestList()
ReportController.java | Get(value="/rooming.csv",produces="text/csv") ResponseEntity<String> rooming()
SiteController.java | @RestController Base("/api/v1/guest/site")
SiteController.java | Get("/config") Map<String,Object> config()
SiteController.java | Get("/faq") List<Map<String,Object>> faq()
SiteController.java | Get("/schedule") List<Map<String,Object>> schedule(@AuthenticationPrincipal Principal p)
SiteController.java | Get("/things-to-do") List<Map<String,Object>> thingsToDo()
SiteController.java | Get("/travel") Map<String,Object> travel()

## Database schema (Flyway migrations)

Latest migration: `V24__guest_login_throttle.sql`

| Migration | Tables touched |
|---|---|
| V1__initial_schema.sql | accommodation_assignment,accommodation_change_request,accommodation_property,accommodation_room,audit_record,budget_category,budget_contributor,budget_line_item,budget_line_item_contributor,event,event_eligibility,fx_rate_snapshot,guest,invitation,invitation_delivery,party,planner_user,rsvp,venue |
| V2__planner_ui_lifecycle.sql | accommodation_property,accommodation_room,budget_category,budget_contributor,budget_line_item,event,venue |
| V3__public_site.sql | event,media_asset,site_page,site_settings,travel_item |
| V4__invitation_cards.sql | invitation,site_settings |
| V5__things_to_do.sql | site_settings,thing_to_do_item |
| V6__venue_and_guest_metadata.sql | guest,venue,venue_fee,venue_room |
| V7__merge_accommodations_into_venue.sql | accommodation_assignment,guest,venue_room |
| V8__more_site_images.sql | site_page,site_settings |
| V9__venue_image_field_cleanup.sql | venue |
| V10__rsvp_party_invite_integrity.sql | rsvp |
| V11__invitation_card_background.sql |  |
| V12__invitation_card_layout.sql | site_settings |
| V14__invitation_card_field_color.sql |  |
| V15__invitation_card_invite_url_field.sql | site_settings |
| V16__drop_budget_module.sql |  |
| V17__invitation_card_two_sided.sql | site_settings |
| V18__site_content_cleanup.sql | faq_item,site_page,site_settings,travel_flight,travel_hotel |
| V19__guest_attendance_probability_na.sql | guest |
| V20__universal_event_eligibility.sql |  |
| V21__site_layout_toggle.sql | site_settings |
| V22__site_styling_and_home_design.sql | site_settings |
| V23__tile_styling.sql | site_settings |
| V24__guest_login_throttle.sql | guest_login_throttle |

## Frontend apps

### frontend/internal
- frontend/internal/src/pages/accommodations/AccommodationsPage.tsx
- frontend/internal/src/pages/DashboardPage.tsx
- frontend/internal/src/pages/events/EventsPage.tsx
- frontend/internal/src/pages/invitations/CardDesignSection.tsx
- frontend/internal/src/pages/invitations/InvitationsPage.tsx
- frontend/internal/src/pages/parties/PartiesPage.tsx
- frontend/internal/src/pages/parties/PartyDetailPage.tsx
- frontend/internal/src/pages/reports/ReportsPage.tsx
- frontend/internal/src/pages/site/SitePage.tsx
- frontend/internal/src/pages/venues/VenueDetailPage.tsx
- frontend/internal/src/pages/venues/VenueFeesManager.tsx
- frontend/internal/src/pages/venues/VenueRoomsManager.tsx

### frontend/public
- frontend/public/src/pages/ContentPage.tsx
- frontend/public/src/pages/FaqPage.tsx
- frontend/public/src/pages/HomePage.tsx
- frontend/public/src/pages/OnePage.tsx
- frontend/public/src/pages/SchedulePage.tsx
- frontend/public/src/pages/ThingsToDoPage.tsx
- frontend/public/src/pages/TravelPage.tsx

## File inventory

### Backend (`backend/src/main/java`)
- backend/src/main/java/com/wedding/service/api/ApiErrorHandler.java
- backend/src/main/java/com/wedding/service/api/ApiException.java
- backend/src/main/java/com/wedding/service/api/AuthController.java
- backend/src/main/java/com/wedding/service/api/GuestController.java
- backend/src/main/java/com/wedding/service/api/GuestImportController.java
- backend/src/main/java/com/wedding/service/api/InternalController.java
- backend/src/main/java/com/wedding/service/api/InternalDataController.java
- backend/src/main/java/com/wedding/service/api/InvitationCardController.java
- backend/src/main/java/com/wedding/service/api/MediaController.java
- backend/src/main/java/com/wedding/service/api/ReportController.java
- backend/src/main/java/com/wedding/service/api/RequestIdFilter.java
- backend/src/main/java/com/wedding/service/api/SiteController.java
- backend/src/main/java/com/wedding/service/config/AppProperties.java
- backend/src/main/java/com/wedding/service/config/WebConfig.java
- backend/src/main/java/com/wedding/service/security/JwtFilter.java
- backend/src/main/java/com/wedding/service/security/JwtService.java
- backend/src/main/java/com/wedding/service/security/Principal.java
- backend/src/main/java/com/wedding/service/security/SecurityConfig.java
- backend/src/main/java/com/wedding/service/service/BootstrapService.java
- backend/src/main/java/com/wedding/service/service/DataService.java
- backend/src/main/java/com/wedding/service/service/GuestLoginThrottle.java
- backend/src/main/java/com/wedding/service/service/InvitationCardRenderer.java
- backend/src/main/java/com/wedding/service/service/MediaSeedService.java
- backend/src/main/java/com/wedding/service/service/MediaService.java
- backend/src/main/java/com/wedding/service/service/SlackNotifier.java
- backend/src/main/java/com/wedding/service/WeddingServiceApplication.java

### frontend/internal/src
- frontend/internal/src/api/client.ts
- frontend/internal/src/api/hooks.ts
- frontend/internal/src/api/types.ts
- frontend/internal/src/App.tsx
- frontend/internal/src/auth/AuthContext.tsx
- frontend/internal/src/auth/LoginPage.tsx
- frontend/internal/src/components/index.tsx
- frontend/internal/src/index.css
- frontend/internal/src/lib/format.ts
- frontend/internal/src/main.tsx
- frontend/internal/src/pages/accommodations/AccommodationsPage.tsx
- frontend/internal/src/pages/DashboardPage.tsx
- frontend/internal/src/pages/events/EventsPage.tsx
- frontend/internal/src/pages/invitations/CardDesignSection.tsx
- frontend/internal/src/pages/invitations/cardLayout.ts
- frontend/internal/src/pages/invitations/InvitationsPage.tsx
- frontend/internal/src/pages/parties/PartiesPage.tsx
- frontend/internal/src/pages/parties/PartyDetailPage.tsx
- frontend/internal/src/pages/reports/ReportsPage.tsx
- frontend/internal/src/pages/site/SitePage.tsx
- frontend/internal/src/pages/venues/VenueDetailPage.tsx
- frontend/internal/src/pages/venues/VenueFeesManager.tsx
- frontend/internal/src/pages/venues/VenueRoomsManager.tsx
- frontend/internal/src/vite-env.d.ts

### frontend/public/src
- frontend/public/src/api/client.ts
- frontend/public/src/api/hooks.ts
- frontend/public/src/api/types.ts
- frontend/public/src/App.tsx
- frontend/public/src/auth/GuestAuthContext.tsx
- frontend/public/src/auth/UnlockPage.tsx
- frontend/public/src/components/index.tsx
- frontend/public/src/index.css
- frontend/public/src/lib/format.ts
- frontend/public/src/lib/scroll.ts
- frontend/public/src/lib/theme.ts
- frontend/public/src/main.tsx
- frontend/public/src/pages/ContentPage.tsx
- frontend/public/src/pages/FaqPage.tsx
- frontend/public/src/pages/HomePage.tsx
- frontend/public/src/pages/OnePage.tsx
- frontend/public/src/pages/SchedulePage.tsx
- frontend/public/src/pages/ThingsToDoPage.tsx
- frontend/public/src/pages/TravelPage.tsx
- frontend/public/src/vite-env.d.ts

