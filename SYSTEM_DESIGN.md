# Wedding Planning Backend — System Design

## 1. Overview

This service is the backend for a South Asian wedding-planning application for a wedding held in Nepal over two to three days. It supports two separate frontends:

- **Guest application:** approximately 200 invited guests use it to view their invitation, schedule, and accommodation details, and submit event-specific RSVPs. Its first release is a public wedding site with Home, Schedule, Travel, Things to Do, and FAQ tabs gated behind the existing QR-token/verification-answer session; RSVP exists as a content row a planner can toggle visible without a code change (a generic heading + body page). It is a React single-page application served by Nginx in the same compose stack, reachable at `http://localhost:3001` in the local environment.
- **Planner application:** approximately five planners use it to manage wedding data, invitations, attendance, accommodation, venues, and the public site's content. The planner application is a React single-page application served by Nginx in the same compose stack, reachable at `http://localhost:3000` in the local environment.

The backend exposes a versioned HTTP API. Internal and guest-facing endpoints are separated so their intended audience and authorization policies are unambiguous.

## 2. Goals and Success Criteria

The system enables planners to import and manage approximately 200 guests, create a multi-day schedule, assign invitations and accommodations, collect RSVPs, and export reliable attendance and rooming information.

Success means that:

- A guest can securely access only their own invitation party, RSVP for eligible attendees, and see their relevant schedule and accommodation information.
- A planner can make and trace changes to guest, RSVP, assignment, and venue data.
- Planners can produce final event attendance, dietary, and accommodation reports without manual reconciliation.

## 3. Scope

### In scope

- Guest, household/party, invitation, event, venue, RSVP, and accommodation management.
- Planner and guest authentication and authorization.
- Invitation delivery and RSVP reminders.
- Planner exports for attendance, dietary requirements, and room assignments.
- A planner-editable public wedding site (Home, Schedule, Travel, Things to Do, and FAQ tabs at initial release; RSVP toggle-able for later release) and the image uploads it displays. A planner also chooses the site's overall shape — separate pages per tab, or one page with anchored sections — without a deploy, restyles its header/site font, size, and color, and can replace the entire Home page with one uploaded, self-designed image.

### Out of scope (initial release)

- Public ticket sales or payments from guests.
- Flight booking, visa processing, or hotel booking integrations.
- A native mobile application.

## 4. Users, Roles, and Permissions

| Role | Permissions |
| --- | --- |
| Guest | View and update permitted details for their invitation party; view eligible events and assigned accommodation; RSVP for eligible attendees. |
| Planner | Create and manage wedding data, record or edit RSVPs, assign accommodations, manage venues, and export reports. |
| Admin (optional) | Manage planner accounts and system-level configuration. |

Guests must never access another invitation party's contact, travel, RSVP, accommodation, or dietary information. Role-based access control (RBAC) is used. All planners have the same permissions.

## 5. Functional Requirements

### 5.1 Guest and invitation management

- Planners can create, import, edit, archive, search, and segment guests.
- A guest belongs to an invitation **party** (for example, an individual, couple, or household). A party contains one or more named attendees and may include a permitted plus-one.
- Store guest name, contact details, relationship/group (family/relative/friend/other), dietary requirements, accessibility needs, travel origin and arrival details, and planner-only notes.
- List-building metadata for segmenting and planning invite rounds: which side of the wedding the guest belongs to (bride/groom), attendance probability (certain/very likely/likely/maybe/unlikely/N-A), wedding-party membership, passport (Nepali/Indian/other, for visa lead time), Kathmandu residency, child status (for catering headcount), room assignment, and invite round.
- Guests may update their party’s contact information, dietary restrictions, travel plans (including flight number), and information for named additional guests. Planners control all other guest fields and each guest's per-event RSVP.
- An invitation is issued to a party, not a single person. Its lifecycle is: `draft → sent → viewed → responded → closed`. A reminder may be sent while it remains open.
- Planners can record an RSVP on a guest’s behalf (for phone or in-person responses).
- Each invitation can be rendered as a printable, two-sided A6 card: a front that's pure planner-uploaded artwork (cover-cropped to the card, nothing else drawn on it) and a back carrying a QR code that resolves to the guest site's `/i/{qrToken}` route, the invite URL as text, and the party's name — each independently positioned, sized, and colored, over its own planner-uploaded background image. The card can be portrait or landscape (one setting, shared by both sides). There is no other planner-authored card text. Planners can download a single party's card or every party's card as one PDF (two pages per card, front then back, alternating — the order a duplex printer needs), and can reprint without invalidating a card already mailed.

### 5.2 Events and venues

- Planners can create events for each wedding day, such as mehndi, sangeet, ceremony, and reception.
- An event includes name, description, start and end time, venue, dress code, capacity, and RSVP deadline.
- Store all timestamps in UTC and present wedding times in `Asia/Kathmandu` unless the client requests another display timezone.
- Planners can add venues and record metadata including pricing, capacity, food score, view score, address, contact information, and notes, plus comparison metadata for venues around Kathmandu: location, distance from Kathmandu, whether guest transportation must be arranged, and a room-block min/max the venue has committed to.
- A venue's cost is tracked as two child lists rather than a single price: **room rates** (a room type with occupancy, room count, and separate Nepali/foreigner nightly rates) and **fees** (a named charge — sangeet-day catering, wedding lunch catering, wedding dinner catering, or corkage — with an amount). The venue list shows each venue's total room-block size, total sleeping capacity, and total fees so candidate venues can be compared without opening each one.
- A venue may host multiple events; an event has one primary venue.
- A venue is also the lodging entity for guest accommodation (see §5.4): a venue room row optionally carries a room number, making it either a room-block quoting entry (type and count only, for cost comparison) or a specific bookable room (numbered, used for guest room assignments) — the same room list serves both purposes.

### 5.3 RSVPs

- **Every party attends every event; each guest in that party responds individually.** There is no per-event invitation step — a party is automatically included in every event the moment either exists — and the RSVP itself is collected **per attendee, per event**, with statuses `attending`, `declined`, `pending`, and `waitlisted` — one guest in a party can attend while another declines the same event. The planner UI reflects this directly: there is no cross-party RSVP screen and no invite/un-invite action, only a guests × events matrix on each party's detail page (planner design §5.3).
- An RSVP can include dietary requirements, accessibility needs, plus-one information where allowed, and a guest-facing note.
- A party may decline one event and attend another.
- RSVP changes are allowed until the event’s RSVP deadline. Planners may override this restriction.
- If an event reaches capacity, planners can place additional attendees on a waitlist; promotions and any manual guest communications are planner-controlled.

### 5.4 Accommodations

- The wedding venue is also where guests stay: rooms and room inventory are managed as part of the venue (§5.2), not as a separate property entity.
- Planners can manage room assignments against that venue room inventory: check-in/check-out windows and confirmation status.
- An assignment is made to a guest or party and includes room, occupants, check-in/check-out dates, eligibility/coverage notes, and confirmation status.
- Support guests with no provided accommodation, shared rooms, and partial-stay assignments.
- Guests can view their assignment. Guest requests for changes are recorded as requests; only planners change actual assignments.

### 5.7 Planner Web Application

The planner UI covers every functional-requirement action in §5.1–5.6: login with session stored in memory only (a refresh returns to the login screen); a dashboard showing summary counts; party and guest management including bulk CSV import and QR-token issuance; events and venues, room-block cost comparison, and room inventory management (every party and guest is auto-enrolled in every event, so there is no invite/eligibility step); a per-party RSVP matrix on the party detail page with manual override and source-note support; accommodations with room assignments across that venue room inventory, an overbooking override toggle (audited), and a change-request inbox; a Wedding Site workspace (general site settings, per-tab visibility toggles and copy edited from one Pages screen, structured Travel hotel/flight lists, FAQ items, things-to-do items, image uploads); and one-click CSV report downloads.

### 5.6 Notifications and reporting

- Planners deliver physical invitations and any reminders manually; the initial release does not send email, SMS, or WhatsApp messages to guests.
- Planners can record invitation delivery and reminder dates manually, including an optional delivery note.
- Planners can export CSV reports for event attendance, dietary/accessibility requirements, RSVP status, and rooming lists.
- Whenever a guest's RSVP status changes for an event — including a change back to pending — the backend posts a message to a planner Slack channel (via an incoming webhook) naming the guest, their party, the event, and their new response, plus any note they or a planner left on that RSVP. This is a planner-facing alert, not guest-facing delivery, and it does not change the "no notification-provider integration" decision in §12, which is about messages sent *to guests*.

### 5.8 Guest Web Application

- A guest reaches the site by entering their own name, which maps to their guest record and hence their party, then answers that party's verification question — the credential used by the guest API — to start a session. The session persists in the browser's `localStorage` (not memory-only, unlike the planner app) so a guest returning to the site over the months before the wedding isn't re-prompted every visit; it expires with the underlying 30-day guest token.
- **Home:** hero image, both partners' names, a wedding date **range** (start and end date), a short tagline, and free-form heading/body copy — all planner-editable, none hardcoded.
- **Schedule:** an optional planner-set banner image above the heading, then every event marked planner-visible on the public site (every party attends every event, so there's no per-party filter beyond that), each showing time, venue, dress code, and description in the wedding's configured display timezone. An event can be hidden from this tab (`public_visible = false`) without affecting whether it still collects RSVPs — the two are independent switches.
- **Travel:** an optional planner-set banner image and body copy, then two planner-curated lists rendered below it: **Hotels** (name, address, link, description) and **Flights** (route name, duration, estimated cost, description) — both free-text `duration`/`estimated_cost` fields, since a range or non-USD amount is common and there's no currency infrastructure in this app.
- **Things to Do:** an optional planner-set banner image, then a planner-curated list of recommendations (title, description, optional photo, grouping category), rendered on the public site grouped by category.
- **FAQ:** an optional planner-set banner image and body copy, then a planner-curated list of question/answer pairs.
- Any additional tab a planner marks visible (currently just RSVP — see §12) renders automatically as an optional banner image + heading + body page with zero additional code, so turning on a new tab is a content edit, not a deployment.

## 6. Core Data Model

```text
Party 1 ── * Guest
Party 1 ── 1 Invitation
Invitation 1 ── * InvitationEvent ── 1 Event
Guest 1 ── * RSVP ── 1 Event
Event * ── 1 Venue
Venue 1 ── * VenueRoom
Venue 1 ── * VenueFee
Guest * ── 1 VenueRoom (planning-stage room assignment)
Party/Guest 1 ── * AccommodationAssignment ── 1 VenueRoom
SiteSettings 1 ── 1 MediaAsset (hero image)
SiteSettings 1 ── 1 MediaAsset (invitation card front image)
SiteSettings 1 ── 1 MediaAsset (invitation card back image, optional)
SitePage (0 or more visible, ordered) 1 ── 1 MediaAsset (optional banner)
ThingToDoItem * ── 1 MediaAsset (optional)
FaqItem (0 or more, ordered)
TravelHotel (0 or more, ordered)
TravelFlight (0 or more, ordered)
```

Key entities and required relationships:

- **Party:** the invitation and access boundary; owns members, contact preferences, and invitation state.
- **Guest:** a named attendee, including personal requirements, optional travel details, list-building metadata (wedding side, attendance probability, wedding-party flag, passport, KTM residency, child flag, invite round), and an optional planning-stage room assignment.
- **Event:** a scheduled wedding activity with capacity rules; every party attends every event.
- **Venue room:** a room type offered by a venue's room block (occupancy, room count, Nepali/foreigner nightly rates), optionally identified by a room number when it's a specific bookable room rather than a room-block quoting entry — the same entity backs both venue cost comparison and guest accommodation.
- **Venue fee:** a named per-event charge from a venue (catering by event, or corkage) with an amount.
- **RSVP:** links one guest to one event; this is the attendance source of truth.
- **Accommodation assignment:** links a party or guest to a specific venue room for a date range.
- **Audit record:** records the actor, timestamp, action, entity, and before/after values for planner changes to guests, RSVPs, and accommodations.
- **Site settings:** a single-row table of wedding-wide, site-identity content only — partner names, wedding start/end date, display timezone, hero image/tagline — plus the invitation card's front/back image references, orientation, and the QR/invite-URL/guest-name layout (position, size, color for each — there's no other planner-authored card text). Per-tab heading/body copy lives on `site_page` instead (see below), not here.
- **Site page:** one row per public-site tab (slug, label, heading, sort order, visibility, body, optional banner image). Home/Schedule/Travel/Things to Do/FAQ have dedicated frontend pages that read their own row's heading/body/image; every other row (currently just RSVP) renders generically once made visible. The planner edits a tab's heading/body/image from one place — the Pages screen's Edit modal — rather than a separate Content form.
- **Thing to do item:** a planner-entered recommendation (category, title, description) shown on the Things to Do tab, with an optional image.
- **FAQ item:** a planner-entered question/answer pair shown on the FAQ tab.
- **Travel hotel:** a planner-entered lodging recommendation (name, address, link, description) shown on the Travel tab.
- **Travel flight:** a planner-entered flight/route recommendation (route name, duration, estimated cost, description) shown on the Travel tab.
- **Media asset:** an uploaded image (hero photo, tab banner image, things-to-do item photo, invitation card front/back image) stored on disk and referenced by ID; served unauthenticated since `<img>` tags can't carry a bearer token.

## 7. API Design

Use JSON over HTTPS and version all endpoints under `/api/v1`.

- Planner endpoints: `/api/v1/internal/...`
- Guest endpoints: `/api/v1/guest/...`
- Authentication endpoints: `/api/v1/auth/...`

Examples:

```text
POST   /api/v1/internal/guests/import
GET    /api/v1/internal/venues/{venueId}
POST   /api/v1/internal/venues/rooms
POST   /api/v1/internal/venues/fees
GET    /api/v1/internal/reports/guest-list.csv
GET    /api/v1/internal/events/{eventId}/attendance-report
POST   /api/v1/internal/invitations/{invitationId}/record-delivery
GET    /api/v1/guest/party
PUT    /api/v1/guest/rsvps/{rsvpId}
GET    /api/v1/guest/accommodation
GET    /api/v1/guest/site/config
GET    /api/v1/guest/site/schedule
GET    /api/v1/guest/site/things-to-do
GET    /api/v1/guest/site/faq
GET    /api/v1/guest/site/travel
POST   /api/v1/internal/media
PATCH  /api/v1/internal/site/settings
GET    /api/v1/internal/parties/{partyId}/invitation-card.pdf
GET    /api/v1/internal/invitation-cards.pdf
POST   /api/v1/internal/invitation-cards/issue-missing
```

Two endpoints are deliberately unauthenticated beyond the auth endpoints themselves, since the tokens involved can't be attached the normal way: `POST /api/v1/guest/invitations/lookup` (resolves a guest's name to their party and shows its verification question, before a guest session exists) and `GET /api/v1/media/{id}` (an `<img src>` cannot send a Bearer header, so uploaded images are served by opaque ID instead).

API standards:

- Use resource IDs that are opaque and non-sequential to clients.
- Paginate planner list endpoints and support documented filtering/sorting.
- Return a consistent error body containing a machine-readable code, user-safe message, and request ID.
- Validate input server-side; client validation is supplemental only.
- Document request/response schemas, authorization, errors, and examples in OpenAPI.

## 8. Authentication and Security

- Planners authenticate through email/password. The planner web app keeps the JWT in memory only; a page refresh forces re-login. This is an explicit tradeoff for simplicity in a low-volume, five-user tool.
- (Future hardening) MFA and identity-provider integration can be added without changing the guest authentication model.
- Guests authenticate by name plus their party's verification answer; passwords are not required. The name identifies the party and is not treated as secret — the bcrypt-hashed verification answer is the only access factor, so it should be something only the invited party knows.
- Because that answer is a single low-entropy secret, guest login is throttled per party: 5 answers per minute, a 5-minute lock after 10 consecutive wrong answers (re-arming every further 10), and a permanent lock after 30 that only an **admin** can clear (`POST /api/v1/internal/parties/{id}/unlock`). A correct answer resets all of it. Planners see the lock state on the party detail page; there is deliberately no self-service reset on the guest site, since the only thing a guest could prove is the answer they just failed.
- The invitation token still exists (it identifies an invitation and is printed on cards) but is no longer an entry credential; guest sessions expire and are rate-limited.
- The invitation token is stored in the database in recoverable form, not only as a lookup hash, so a printable card can be regenerated or reprinted without rotating a token that may already be in the post. This is safe under the same threat model as the QR code itself: the token is only the first of two access factors (the party's verification answer is the second, bcrypt-hashed), and it is printed in plaintext on the card regardless of how it's stored. Treat database backups and exports with the same care as printed invitation stock.
- Enforce authorization at the service layer for every request; do not rely on the frontend to hide data or actions.
- Treat contact information, dietary/accessibility details, travel details, and accommodation assignments as sensitive personal data. Encrypt data in transit, protect secrets in a secrets manager, and restrict access in logs.
- Maintain an audit trail for planner-initiated changes to sensitive or operationally important data.
- Define a retention and deletion policy after the wedding, including exports and backups.

## 9. Non-Functional Requirements

- Approximately 200 external users, each expected to make no more than five visits; approximately five planners, averaging one visit per day.
- Optimize for correctness, privacy, usability, and recoverability rather than high throughput.
- Target normal API responses under 500 ms excluding external notification providers.
- Design for at least 99.5% availability during the RSVP collection period and wedding days.
- Create automated database backups at least daily and test restoration before invitations are sent.
- Centralize structured logs, error tracking, health checks, and alerts for failed backups and elevated API errors.

## 10. Technology and Deployment

- **Backend:** Java with Spring Boot.
- **Database:** relational database (PostgreSQL recommended) for transactional relationships, reporting, and auditability.
- **Planner web app:** React 18 + TypeScript + Vite, served by Nginx in production. JWT kept in memory only; a page refresh forces re-login.
- **Guest web app:** React 18 + TypeScript + Vite, served by Nginx in production. Guest token persists in `localStorage` (see §5.8) — the one deliberate deviation from the planner app's memory-only session.
- **API documentation:** OpenAPI/Swagger generated from the service.
- **Deployment:** containerized service with separate development, staging, and production environments. Local compose stack runs `db`, `api`, `web-internal`, and `web-public`; the planner UI is at `http://localhost:3000`, the guest site at `http://localhost:3001`, both proxying `/api` to the backend. Uploaded images are written to a named Docker volume mounted into the `api` service. The API's `PUBLIC_SITE_URL` configuration value is the guest site's public origin, used to build the full QR payload (`{PUBLIC_SITE_URL}/i/{token}`) printed on invitation cards — set it to the real domain before printing cards for mailing.
- **Production hosting (Render):** `render.yaml` (repo root) is a Blueprint that provisions `wedding-api` (the backend, `runtime: docker` from `backend/Dockerfile`), `wedding-guest` and `wedding-planner` (the two frontends, each a free `runtime: static` site built from `dist/`), and `wedding-db` (paid Postgres — Render's free Postgres plan expires 30 days after creation). Unlike Docker Compose, the frontends are **not** same-origin with the API — Render Static Sites can't run the nginx reverse-proxy config used locally — so they call the API's absolute `https://wedding-api.onrender.com` URL instead, set at build time via `VITE_API_BASE_URL` (read in each frontend's `api/client.ts`; empty in Compose, so local behavior is unchanged) and permitted server-side via `WEDDING_CORS_ALLOWED_ORIGINS`. The blueprint ships with `wedding-api` on Render's free web-service plan (spins down after 15 min idle, ~1 min cold start on the next request) and no persistent disk, so planner-uploaded media does not survive a redeploy/restart — attach a paid plan + disk at `WEDDING_MEDIA_DIR` if that starts to matter.
- **Configuration:** environment-specific configuration and secrets stored outside source control.

## 11. Product Policies and Edge Cases

- A guest can RSVP only for people in their party, for any non-archived event.
- Plus-ones and children must be named or counted according to the invitation’s configured rule; a guest cannot add an unapproved attendee.
- Planners may edit an RSVP after a deadline and must be able to record a source/note for manual changes.
- Schedule or venue changes must be visible to affected guests in the guest application. Planners communicate urgent changes manually outside the system.
- Dietary and accessibility information is captured per guest, not merely for the party’s RSVP owner.
- Capacity changes must not automatically remove existing confirmed attendees.
- Accommodation room capacity must prevent overbooking unless a planner explicitly overrides it with an audited action.

## 12. Initial-Release Decisions

- **Notifications:** Invitations and reminders are delivered manually by planners; no guest-facing notification-provider integration is included. A one-way, planner-facing Slack alert on RSVP is the one exception (§5.6) — it's an internal heads-up, not part of the guest communication flow.
- **Guest access:** A guest signs in with their own name plus their party's verification answer.
- **Guest-editable data:** Contact information, dietary restrictions, travel plans/flight number, and information for named additional guests.
- **Language:** English only.
- **Planner access:** RBAC is used, with one planner role that has the same permissions for every planner.
- **Public site content model:** fixed typed fields per tab (not free-form content blocks), so Home/Schedule/Travel/Things to Do/FAQ stay simple planner forms. Every tab's heading/body/banner image lives as one row on `site_page`, edited from a single Pages screen, rather than split across a separate Content form and per-tab settings columns. Home, Schedule, Travel, Things to Do, and FAQ are hand-built pages; Schedule reuses the existing `event`/`event_eligibility` data rather than a parallel content table; Things to Do, Travel, and FAQ each pair their `site_page` heading/body with a planner-curated item list (`thing_to_do_item`, category-grouped; `travel_hotel`/`travel_flight`; `faq_item`) — Travel's structured hotel/flight lists replace the free-text-only body it briefly had after `V5`. The Zola-style tabs that had no real content model (Our Story, Wedding Party, Photos, Registry) were removed outright rather than left hidden, since nothing was using them; RSVP remains seeded hidden and renders generically (heading + body) the moment a planner makes it visible — no redeploy needed to add a tab, only to change its layout.
- **Public site presentation model:** the same tab content (above) can be shown two ways — `site_settings.site_layout`'s `MULTI_PAGE` (each tab its own route) or `SINGLE_PAGE` (every tab an anchored section on one page). This is a presentation-only switch: it reuses the same `site_page`/hand-built-page content unchanged and doesn't add a second content model. RSVP is always routed separately in either layout, since it's submitted through rather than just read. See `frontend/public/SYSTEM_DESIGN.md` §5.8 for the guest-app mechanics.
- **Public site styling model:** 8 nullable `site_settings` columns (header/site × font family/color/size/background color, null = built-in look) let a planner restyle the guest site, plus `home_design_image_id`/`home_design_only` for a Home page that's designed entirely outside the app and shown as one image. Both are edited on the planner UI's Site → General/Pages tabs and take effect with no deploy. See `frontend/public/SYSTEM_DESIGN.md` §5.9–§5.10 for the guest-app mechanics (CSS-variable theming, the 10 bundled fonts) and `backend/SYSTEM_DESIGN.md` §12 for why these columns are validated differently from `site_layout`.
