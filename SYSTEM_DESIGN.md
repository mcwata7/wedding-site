# Wedding Planning Backend — System Design

## 1. Overview

This service is the backend for a South Asian wedding-planning application for a wedding held in Nepal over two to three days. It supports two separate frontends:

- **Guest application:** approximately 200 invited guests use it to view their invitation, schedule, and accommodation details, and submit event-specific RSVPs. Its first release is a bare-bones public wedding site (Home, Travel, Schedule, Things to Do tabs) gated behind the existing QR-token/verification-answer session; additional tabs (Our Story, Wedding Party, Photos, FAQ, Registry, RSVP) exist as content rows a planner can toggle visible without a code change. It is a React single-page application served by Nginx in the same compose stack, reachable at `http://localhost:3001` in the local environment.
- **Planner application:** approximately five planners use it to manage wedding data, invitations, attendance, accommodation, venues, budgets, and the public site's content. The planner application is a React single-page application served by Nginx in the same compose stack, reachable at `http://localhost:3000` in the local environment.

The backend exposes a versioned HTTP API. Internal and guest-facing endpoints are separated so their intended audience and authorization policies are unambiguous.

## 2. Goals and Success Criteria

The system enables planners to import and manage approximately 200 guests, create a multi-day schedule, assign invitations and accommodations, collect RSVPs, and export reliable attendance, rooming, and budget information.

Success means that:

- A guest can securely access only their own invitation party, RSVP for eligible attendees, and see their relevant schedule and accommodation information.
- A planner can make and trace changes to guest, RSVP, assignment, venue, and budget data.
- Planners can produce final event attendance, dietary, accommodation, and budget reports without manual reconciliation.

## 3. Scope

### In scope

- Guest, household/party, invitation, event, venue, RSVP, accommodation, and budget management.
- Planner and guest authentication and authorization.
- Invitation delivery and RSVP reminders.
- Planner exports for attendance, dietary requirements, room assignments, and budget summaries.
- A planner-editable public wedding site (Home, Travel, Schedule, Things to Do tabs at initial release; additional tabs toggle-able for later release) and the image uploads it displays.

### Out of scope (initial release)

- Public ticket sales or payments from guests.
- Flight booking, visa processing, or hotel booking integrations.
- A native mobile application.

## 4. Users, Roles, and Permissions

| Role | Permissions |
| --- | --- |
| Guest | View and update permitted details for their invitation party; view eligible events and assigned accommodation; RSVP for eligible attendees. |
| Planner | Create and manage wedding data, record or edit RSVPs, assign accommodations, manage venues and budgets, and export reports. |
| Admin (optional) | Manage planner accounts and system-level configuration. |

Guests must never access another invitation party's contact, travel, RSVP, accommodation, or dietary information. Role-based access control (RBAC) is used. All planners have the same permissions, including budget access.

## 5. Functional Requirements

### 5.1 Guest and invitation management

- Planners can create, import, edit, archive, search, and segment guests.
- A guest belongs to an invitation **party** (for example, an individual, couple, or household). A party contains one or more named attendees and may include a permitted plus-one.
- Store guest name, contact details, relationship/group, dietary requirements, accessibility needs, travel origin and arrival details, and planner-only notes.
- Guests may update their party’s contact information, dietary restrictions, travel plans (including flight number), and information for named additional guests. Planners control all other guest fields and attendee eligibility.
- An invitation is issued to a party, not a single person. Its lifecycle is: `draft → sent → viewed → responded → closed`. A reminder may be sent while it remains open.
- Planners can record an RSVP on a guest’s behalf (for phone or in-person responses).
- Each invitation can be rendered as a printable A6 card carrying a QR code that resolves to the guest site's `/i/{qrToken}` route, using planner-uploaded artwork and editable heading/body/footer text. Planners can download a single party's card or every party's card as one PDF, and can reprint without invalidating a card already mailed.

### 5.2 Events and venues

- Planners can create events for each wedding day, such as mehndi, sangeet, ceremony, and reception.
- An event includes name, description, start and end time, venue, dress code, capacity, RSVP deadline, and attendee eligibility.
- Store all timestamps in UTC and present wedding times in `Asia/Kathmandu` unless the client requests another display timezone.
- Planners can add venues and record metadata including pricing, capacity, food score, view score, address, contact information, and notes.
- A venue may host multiple events; an event has one primary venue.

### 5.3 RSVPs

- RSVPs are collected **per attendee, per event**, with statuses `attending`, `declined`, `pending`, and `waitlisted`.
- An RSVP can include dietary requirements, accessibility needs, plus-one information where allowed, and a guest-facing note.
- A party may decline one event and attend another.
- RSVP changes are allowed until the event’s RSVP deadline. Planners may override this restriction.
- If an event reaches capacity, planners can place additional eligible attendees on a waitlist; promotions and any manual guest communications are planner-controlled.

### 5.4 Accommodations

- Planners can manage accommodation properties, room inventory, room types, check-in/check-out windows, and room assignments.
- An assignment is made to a guest or party and includes property, room, occupants, check-in/check-out dates, eligibility/coverage notes, and confirmation status.
- Support guests with no provided accommodation, shared rooms, and partial-stay assignments.
- Guests can view their assignment. Guest requests for changes are recorded as requests; only planners change actual assignments.

### 5.5 Budget management

- Planners can create budget categories and line items for venues, food, accommodations, transport, and other expenses.
- Each line item records currency, planned amount, actual amount, payment status, due date, payers/contributors, and notes.
- The initial release supports manually entered amounts in NPR and other currencies. A scheduled job retrieves current exchange rates from a selected third-party foreign-exchange-rate provider and stores dated rate snapshots. Combined-currency totals must identify the reporting currency, rate date, and rate source; original amounts and currencies are always retained.
- The system provides planned-versus-actual summaries by category and contributor.

### 5.7 Planner Web Application

The planner UI covers every functional-requirement action in §5.1–5.6: login with session stored in memory only (a refresh returns to the login screen); a dashboard showing summary counts; party and guest management including bulk CSV import and QR-token issuance; events and venues with eligibility management that auto-creates RSVPs; an RSVP table with manual override and source-note support; accommodations with a property/room/assignment hierarchy, an overbooking override toggle (audited), and a change-request inbox; budget categories, contributors, and line items with planned/actual tracking; a Wedding Site workspace (content fields, per-tab visibility toggles, things-to-do items, image uploads); and one-click CSV report downloads.

### 5.6 Notifications and reporting

- Planners deliver physical invitations and any reminders manually; the initial release does not send email, SMS, or WhatsApp messages.
- Planners can record invitation delivery and reminder dates manually, including an optional delivery note.
- Planners can export CSV reports for event attendance, dietary/accessibility requirements, RSVP status, rooming lists, and budget summaries.

### 5.8 Guest Web Application

- A guest reaches the site via their invitation's QR code (`/i/{qrToken}`) or by typing the code manually, then answers the party's verification question — the same credential used by the guest API — to start a session. The session persists in the browser's `sessionStorage` (not memory-only, unlike the planner app) so a guest checking the site on their phone across a wedding weekend isn't re-prompted on every refresh; it still expires with the underlying 2-hour guest token.
- **Home:** hero image, both partners' names, wedding date, a short tagline, and free-form heading/body copy — all planner-editable, none hardcoded.
- **Schedule:** the events the guest's party is eligible for (same eligibility join as the RSVP guest API) and marked planner-visible on the public site, each showing time, venue, dress code, and description in the wedding's configured display timezone. An event can be hidden from this tab (`public_visible = false`) without affecting its RSVP eligibility — the two are independent switches.
- **Travel:** a single planner-editable, multi-paragraph body of free-form travel guidance (lodging, airports, getting around) — no structured per-entry records.
- **Things to Do:** a planner-curated list of recommendations (title, description, optional photo, grouping category), rendered on the public site grouped by category.
- Any additional tab a planner marks visible (Our Story, FAQ, etc. — see §12) renders automatically as a heading + body page with zero additional code, so turning on a new tab is a content edit, not a deployment.

## 6. Core Data Model

```text
Party 1 ── * Guest
Party 1 ── 1 Invitation
Invitation 1 ── * InvitationEvent ── 1 Event
Guest 1 ── * RSVP ── 1 Event
Event * ── 1 Venue
Party/Guest 1 ── * AccommodationAssignment ── 1 AccommodationRoom ── 1 AccommodationProperty
BudgetCategory 1 ── * BudgetLineItem ── * BudgetContributor
SiteSettings 1 ── 1 MediaAsset (hero image)
SiteSettings 1 ── 1 MediaAsset (invitation card artwork)
SitePage (0 or more visible, ordered)
ThingToDoItem * ── 1 MediaAsset (optional)
```

Key entities and required relationships:

- **Party:** the invitation and access boundary; owns members, contact preferences, and invitation state.
- **Guest:** a named attendee, including personal requirements and optional travel details.
- **Event:** a scheduled wedding activity with eligibility and capacity rules.
- **RSVP:** links one guest to one event; this is the attendance source of truth.
- **Accommodation assignment:** links a party or guest to a specific room/property for a date range.
- **Audit record:** records the actor, timestamp, action, entity, and before/after values for planner changes to guests, RSVPs, accommodations, and budgets.
- **Site settings:** a single-row table of planner-editable public-site content (partner names, wedding date, display timezone, hero image/tagline, per-tab heading/body copy), plus the invitation card's artwork reference and editable headline/body/footer text.
- **Site page:** one row per public-site tab (slug, label, sort order, visibility, body). Home/Schedule/Travel/Things to Do have dedicated frontend pages; every other row renders generically once made visible.
- **Thing to do item:** a planner-entered recommendation (category, title, description) shown on the Things to Do tab, with an optional image.
- **Media asset:** an uploaded image (hero photo, things-to-do item photo, invitation card artwork) stored on disk and referenced by ID; served unauthenticated since `<img>` tags can't carry a bearer token.

## 7. API Design

Use JSON over HTTPS and version all endpoints under `/api/v1`.

- Planner endpoints: `/api/v1/internal/...`
- Guest endpoints: `/api/v1/guest/...`
- Authentication endpoints: `/api/v1/auth/...`

Examples:

```text
POST   /api/v1/internal/guests/import
GET    /api/v1/internal/events/{eventId}/attendance-report
POST   /api/v1/internal/invitations/{invitationId}/record-delivery
GET    /api/v1/guest/party
PUT    /api/v1/guest/rsvps/{rsvpId}
GET    /api/v1/guest/accommodation
GET    /api/v1/guest/site/config
GET    /api/v1/guest/site/schedule
GET    /api/v1/guest/site/things-to-do
POST   /api/v1/internal/media
PATCH  /api/v1/internal/site/settings
GET    /api/v1/internal/parties/{partyId}/invitation-card.pdf
GET    /api/v1/internal/invitation-cards.pdf
POST   /api/v1/internal/invitation-cards/issue-missing
```

Two endpoints are deliberately unauthenticated beyond the auth endpoints themselves, since the tokens involved can't be attached the normal way: `POST /api/v1/guest/invitations/lookup` (shows the party's verification question before a guest session exists) and `GET /api/v1/media/{id}` (an `<img src>` cannot send a Bearer header, so uploaded images are served by opaque ID instead).

API standards:

- Use resource IDs that are opaque and non-sequential to clients.
- Paginate planner list endpoints and support documented filtering/sorting.
- Return a consistent error body containing a machine-readable code, user-safe message, and request ID.
- Validate input server-side; client validation is supplemental only.
- Document request/response schemas, authorization, errors, and examples in OpenAPI.

## 8. Authentication and Security

- Planners authenticate through email/password. The planner web app keeps the JWT in memory only; a page refresh forces re-login. This is an explicit tradeoff for simplicity in a low-volume, five-user tool.
- (Future hardening) MFA and identity-provider integration can be added without changing the guest authentication model.
- Each physical invitation contains a unique QR code that resolves to an opaque, unguessable invitation token. Scanning the code starts a guest session for that invitation party; passwords are not required for the initial release.
- QR tokens and guest sessions expire, can be revoked and reissued by planners, and are rate-limited. QR codes are bearer credentials, so planners must treat print files and unused invitations as sensitive materials.
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
- Centralize structured logs, error tracking, health checks, and alerts for failed backups, failed exchange-rate updates, and elevated API errors.

## 10. Technology and Deployment

- **Backend:** Java with Spring Boot.
- **Database:** relational database (PostgreSQL recommended) for transactional relationships, reporting, and auditability.
- **Planner web app:** React 18 + TypeScript + Vite, served by Nginx in production. JWT kept in memory only; a page refresh forces re-login.
- **Guest web app:** React 18 + TypeScript + Vite, served by Nginx in production. Guest token persists in `sessionStorage` (see §5.8) — the one deliberate deviation from the planner app's memory-only session.
- **API documentation:** OpenAPI/Swagger generated from the service.
- **Deployment:** containerized service with separate development, staging, and production environments. Local compose stack runs `db`, `api`, `web-internal`, and `web-public`; the planner UI is at `http://localhost:3000`, the guest site at `http://localhost:3001`, both proxying `/api` to the backend. Uploaded images are written to a named Docker volume mounted into the `api` service. The API's `PUBLIC_SITE_URL` configuration value is the guest site's public origin, used to build the full QR payload (`{PUBLIC_SITE_URL}/i/{token}`) printed on invitation cards — set it to the real domain before printing cards for mailing.
- **Configuration:** environment-specific configuration and secrets stored outside source control.

## 11. Product Policies and Edge Cases

- A guest can RSVP only for people in their party and only for events for which they are eligible.
- Plus-ones and children must be named or counted according to the invitation’s configured rule; a guest cannot add an unapproved attendee.
- Planners may edit an RSVP after a deadline and must be able to record a source/note for manual changes.
- Schedule or venue changes must be visible to affected guests in the guest application. Planners communicate urgent changes manually outside the system.
- Dietary and accessibility information is captured per guest, not merely for the party’s RSVP owner.
- Capacity changes must not automatically remove existing confirmed attendees.
- Accommodation room capacity must prevent overbooking unless a planner explicitly overrides it with an audited action.

## 12. Initial-Release Decisions

- **Notifications:** Invitations and reminders are delivered manually by planners; no notification-provider integration is included.
- **Guest access:** Each physical invitation includes a unique QR code tied to its invitation party.
- **Guest-editable data:** Contact information, dietary restrictions, travel plans/flight number, and information for named additional guests.
- **Currency conversion:** A scheduled integration records current exchange-rate snapshots from a selected external provider for reporting.
- **Language:** English only.
- **Planner access:** RBAC is used, with one planner role that has the same permissions for every planner.
- **Public site content model:** fixed typed fields per tab (not free-form content blocks), so Home/Travel/Schedule/Things to Do stay simple planner forms. Home and Travel are hand-built pages; Schedule reuses the existing `event`/`event_eligibility` data rather than a parallel content table; Things to Do pairs a heading/body pair on `site_settings` with a planner-curated, category-grouped item list (`thing_to_do_item`) — the same shape Travel used before it was simplified to free text only. Remaining Zola-style tabs (Our Story, Wedding Party, Photos, FAQ, Registry, RSVP) are seeded hidden and render generically (heading + body) the moment a planner makes them visible — no redeploy needed to add a tab, only to change its layout.
