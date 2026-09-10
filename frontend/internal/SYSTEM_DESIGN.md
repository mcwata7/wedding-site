# Wedding Planner Internal Tool — System Design

## 1. Overview

This is the planner-facing web application for the wedding-planning system described in the root [`SYSTEM_DESIGN.md`](../../SYSTEM_DESIGN.md). It is a React single-page application used by approximately five planners to manage guests, events, RSVPs, accommodations, and the public wedding site's content for a wedding held in Nepal. It is a thin client: all business rules, validation, and authorization are enforced by the backend API (`backend/`); this application's job is to present that data and collect planner input safely and efficiently.

In Docker, the app is built into static assets and served by Nginx, which also reverse-proxies `/api` to the backend service. In local development, the Vite dev server proxies `/api` to `http://localhost:8080`, so the app never needs to know the backend's real origin.

## 2. Goals and Success Criteria

The tool lets five planners jointly manage the wedding's guest list, schedule, RSVPs, and accommodations from day-to-day without needing direct database or API access.

Success means that:

- A planner can perform every action in the backend's functional requirements (§5.1–§5.6 of the root design) without leaving the browser.
- Destructive or high-consequence actions (archiving, capacity overrides) are deliberate — never a single accidental click — and are traceable back to the backend's audit trail.
- The app fails predictably: a network error, expired session, or validation error always produces a legible message, never a silent failure or a blank screen.

## 3. Scope

### In scope

- Planner authentication and session handling.
- CRUD and status-management screens for parties/guests, invitations, events/venues, RSVPs, accommodations, and change requests.
- CSV-based bulk guest import and CSV report downloads.
- Printable invitation card management: card artwork/text design and PDF downloads, single or bulk (§5.10).
- Client-side surfacing of backend validation and authorization errors.
- Public wedding site content management: general site settings, per-tab visibility/copy toggles, travel hotel/flight lists, FAQ items, things-to-do items, and image uploads (§5.9).

### Out of scope

- Any business logic that duplicates or bypasses backend validation (e.g., computing RSVP status or capacity client-side as a source of truth).
- The guest-facing application (separate frontend, QR/session-code auth, not covered here).
- Offline support, multi-tab session sync, or a native/mobile client.

## 4. Users and Roles

There is a single user type: **Planner**. All planners share one role and see the same navigation and permissions (per root design §4); the UI does not implement its own role gating beyond "authenticated or not." Route-level authorization is enforced by the backend on every request — the frontend's `ProtectedRoute` wrapper is a UX convenience, not a security boundary.

## 5. Functional Requirements

Each item corresponds to a route in `src/App.tsx` and a page in `src/pages/`.

### 5.1 Login (`/login`)

Email/password form posts to `POST /api/v1/auth/planner/login`. On success, the returned JWT is handed to `AuthContext` and the planner is routed to the dashboard. There is no "remember me" — the banner explicitly tells the planner the session ends when the tab closes.

### 5.2 Dashboard (`/`)

Read-only summary counts (parties, guests, events, attending, pending RSVPs, open change requests) from `GET /api/v1/internal/dashboard`, giving planners a landing page that surfaces what needs attention (e.g., open change requests) without navigating further.

### 5.3 Parties & Guests (`/parties`, `/parties/:id`)

- Searchable, paginated list of parties; a detail page per party listing its guests.
- Create/edit parties and guests; issue a QR invitation token for a party; record manual invitation delivery (with an optional note). The current token is shown persistently in the invitation-status strip once issued (`party.token`, from `GET /parties/:id`) — not just transiently in the post-issue "QR Token Modal", which used to be the only place it was ever visible.
- The guest form also covers list-building metadata used to plan invite rounds and catering: relationship (family/relative/friend/other), wedding side (bride/groom), attendance probability, wedding-party flag, passport, KTM residency, child flag, invite round, and an optional room assignment (a `<Select>` fed by `useAllVenueRooms()`, the same flat cross-venue room list used on the Accommodations page).
- **Guest-login lock banner:** if the party has tripped the guest-login brute-force limits (`login_locked_permanently`/`login_locked_until`/`login_failed_count` on `GET /parties/:id`), a red banner explains which lock is in force. Admins get an **Unlock** button (`useUnlockPartyLogin`); planners see the banner without the button, matching the ADMIN-only endpoint. This is the only place the lock is visible, and the guest site has no self-service reset — so a locked-out party depends on a planner opening this page.
- Bulk guest import via CSV upload (`postForm` to `/guests/import`), reporting parties/guests created; a blank import template is downloadable from Reports (§5.8).
- **RSVPs** — a guests × events matrix, below the guest table on `PartyDetailPage`. Every party attends every event automatically (there is no per-event invite/un-invite step); this section is where the response lives instead of on a separate cross-party page (see §5.5's removal below). Column headers are just the event name. Each cell is that guest's RSVP badge for that event, clicking it opens the status + planner-note edit modal (`useUpdateRsvp`) — the only write this section makes. The backend keeps the matrix fully populated as parties/events/guests are added (`DataService.syncRsvps`, backend design §12), so the matrix never manufactures rsvp rows client-side. Status count badges (Attending/Declined/Pending/Waitlisted) sit at the section header, scoped to this party.

### 5.4 Events & Venues (`/events`, `/venues/:id`)

Create and edit events (name, venue, timing, dress code, capacity, RSVP deadline) and venues (pricing, capacity, scores, contact info, location, distance from Kathmandu, whether transportation must be arranged, room-block min/max) from the tabbed `/events` page. Creating an event auto-creates its RSVPs for every existing party on the backend, so this page invalidates the `events` query on success; there is no eligibility step for a planner to manage here any more. The venues table's Rooms/Fees/distance columns come from server-computed roll-ups (`room_block_rooms`, `room_block_beds`, `total_fees`) rather than being derived client-side, and clicking a venue row navigates to its detail page.

`VenueDetailPage` (`/venues/:id`, mirroring `PartyDetailPage`'s nested-list structure) is where a venue's cost — and its room inventory for guest accommodation — actually gets entered: a venue facts panel plus two child tables, **Rooms** (room type, an optional Room # for a specific bookable room, capacity, rooms available, Nepali/foreigner nightly rate) and **Fees** (sangeet-day catering, wedding-lunch catering, wedding-dinner catering, corkage — each a fixed amount), each with its own add/edit modal and archive action. A room row with no Room # is a room-block quoting entry (feeds the venue list's cost roll-ups only); one with a Room # is a specific bookable room, selectable from the Accommodations page's Assignment form and the guest room-assignment dropdown. The facts panel shows the derived totals (`capacity × max_available` summed across rooms, and summed fees) so a planner can compare venues on total cost without doing the arithmetic by hand.

### 5.5 RSVPs — removed, folded into Parties & Guests

There is no longer a standalone `/rsvps` page. An RSVP isn't independent of its party — every party attends every event, the guest is what responds (`rsvp`) — so presenting every guest×event row in one cross-party table, disconnected from the party it belonged to, encouraged treating them as unrelated. The same table, editing, and status counts now live on `PartyDetailPage` (§5.3), scoped to one party at a time, reading `rsvps` off the same `GET /parties/:id` payload as `guests` and `events` rather than a separate `useRsvps` query (removed — nothing else called it). `useUpdateRsvp` (`src/api/hooks.ts`) is unchanged and still backs the matrix's edit modal.

### 5.6 Accommodations (`/accommodations`)

A tabbed workspace: Assignments and Change Requests (the tab label carries an open-request count badge). Room and venue management live on the Events & Venues page (§5.4) instead — a wedding venue is now the lodging property too, so there's no separate Properties/Rooms tab here. The Assignment form's Room picker sources from `useAllVenueRooms()` (the flat cross-venue room list), labeled `Venue — Room Type #RoomNumber`. Assignments support an explicit **"Override capacity limit"** checkbox, styled distinctly (yellow, called out as audited) so a planner cannot overbook a room without a visible, deliberate action. Change requests can be resolved or declined inline; only planners change actual assignments, per root design §5.4.

### 5.7 Budget — removed

The `/budget` page (categories, contributors, and line items with planned/actual tracking and a category summary view) was removed along with its backend endpoints, tables, and the FX-rate-snapshot service that supported it (backend design §9). A future currency-conversion feature, if built, is expected to look up rates live rather than reviving the stored-snapshot approach.

### 5.8 Reports (`/reports`)

One-click CSV downloads for attendance, dietary/accessibility, guest list (relationship/side/probability/passport/room, the list-building metadata from §5.3), and rooming list, plus the blank guest-import template. Downloads are triggered client-side via `api.downloadCsv`, which fetches the CSV as text and saves it through an in-memory `Blob`/`URL.createObjectURL` — no server-side redirect or new tab.

### 5.9 Wedding Site (`/site`)

A tabbed workspace mirroring the Accommodations pattern:

- **General:** a small form over the site-settings singleton — partner names, wedding start/end date (a range, not a single day), display timezone, and the guest site's **Layout**: *Separate pages* (the original per-tab routing) or *One page* (every tab an anchored section on a single page, reached from the same header) — see `frontend/public/SYSTEM_DESIGN.md` §5.8. RSVP is always its own page regardless of this setting. Hero image/tagline moved into the Pages tab's Home edit modal (below); nothing else site-wide-identity-shaped lives here. Below that, three grouped subsections restyle the guest site without a deploy — see `frontend/public/SYSTEM_DESIGN.md` §5.9: **Header Styling**/**Site Styling** (font, font size, font color, background color each) and **Tile Styling** (background color, border color only — for Schedule/Travel/Things To Do's individual cards). Font is a `Select` from the 10 bundled custom fonts (`FONT_FAMILY_OPTIONS`, kept in sync with the guest app's `FONT_FAMILIES` and the backend's `SITE_FONTS`); each color is a native swatch + hex text input (`ColorField`, matching the invitation card designer's QR-color control) with a Reset button, since a native color input has no "empty" state a planner could otherwise use to get back to the unthemed default.
- **Pages:** a table of every public-site tab (including the ones not yet built a dedicated page for) with a Show/Hide toggle and an edit modal for label, sort order, heading, body text, and banner image. This is the single place a tab's copy is edited — Content and Pages used to split this across two tabs with the same underlying concept (per-tab heading/body/image), which this consolidates. Editing the Home row also shows Hero Image/Hero Tagline fields, saved to `site_settings` in the same submit, plus a **Design Image** picker and a "Show only this image on the Home page" checkbox (also `site_settings`, saved in the same submit) — see `frontend/public/SYSTEM_DESIGN.md` §5.10. This is also the control that turns on a future generic tab (currently just RSVP) with no code change — see root design §12.
- **Travel:** two lists, each with its own create/edit/archive modal pair — **Hotels** (name, address, link, description) and **Flights** (route name, duration, estimated cost, description). `duration`/`estimated_cost` are free text so a planner can write a range or a non-USD amount.
- **FAQ:** create/edit/archive for question/answer items shown on the guest site's FAQ tab.
- **Things To Do:** create/edit/archive for things-to-do items (category, title, description, photo), grouped by category on the public site. Category is free text rather than a fixed enum, so planners can define whatever groupings fit their recommendations.
- **Media:** upload and browse images; the same list backs the media picker used throughout this page.

The Events page (`/events`) also gained a **"Show on wedding site Schedule tab"** checkbox — `event.public_visible`, independent of whether the event still collects RSVPs (root design §5.8, backend design §12).

### 5.10 Invitations (`/invitations`)

The one screen `PartyDetailPage`'s QR modal doesn't cover: a party-by-party view of invitation/card status plus the printable-card workflow.

- **Card Design (`CardDesignSection.tsx`):** the card is two-sided, so there are two `MediaPicker`s (front "image only", back "QR side"), both filtered to JPEG/PNG since the backend can't embed WEBP in a PDF, plus an Orientation `Select` (Portrait/Landscape). There is no other planner-authored card text — no font selector anywhere; the whole form is three element blocks (QR, Invite URL, Guest Names), each with X/Y/Size/Color, driven by a shared `ELEMENTS` constant in `cardLayout.ts` so the markup isn't repeated per element (also home to `DEFAULT_LAYOUT`, mirroring `InvitationCardRenderer.DEFAULT_LAYOUT`/`V17`'s default, and `DIMS`, the two orientations' mm dimensions). Color is a paired native `<input type="color">` swatch plus a plain text `Input` bound to the same `#rrggbb` string (now including the QR itself, which used to be code-owned black-only). Changing orientation clamps every element's x/y (and the QR's size) into the new bounds client-side and toasts if anything moved — a proactive mirror of `InternalDataController`'s server-side re-validation of the *stored* layout whenever orientation changes without a paired layout update in the same request. A debounced (~400ms) live preview posts the in-progress (unsaved) form state to `POST /internal/invitation-cards/preview.pdf?side=FRONT` and `...?side=BACK` (`usePreviewInvitationCard`, via `api.postBlob`), two separate requests each returning a single-page PDF, and renders them as two side-by-side `<iframe>`s (front/back) via two object URLs, revoked on the next preview and on unmount — this is what makes 12+ numeric/color inputs tunable without guessing, and lets a planner see the front and back as a matched pair. (Previously this fetched one combined 2-page PDF and paged the two `<iframe>`s to it via `#page=1`/`#page=2` fragments on the same object URL, but browsers' embedded PDF viewers don't reliably honor different page fragments when the same document is embedded twice, so both panes could end up showing the same page.) Save PATCHes the whole `site_settings` shape (front/back image ids, orientation, and the full `invitation_card_layout` object) through the existing `useUpdateSiteSettings`; a bad value (out-of-range size/position, malformed color, bad orientation) 422s/400s with a specific error code, since the backend validates on save, not only at render time.
- **Parties table:** every non-archived party with its invitation status `Badge` and a "Card" readiness badge (`printable`, from `GET /internal/invitations`), plus a per-row **Download PDF** action following the `stopPropagation` action-cell pattern used elsewhere (e.g. `PartyDetailPage`'s guest table).
- **Download All Cards** in the page header downloads every printable party's card as one PDF.
- Both downloads can 409 (`MISSING_INVITATION`/`MISSING_INVITATIONS`) if a party has no printable token yet — the page catches that and shows a confirm modal that calls `POST /internal/invitation-cards/issue-missing` (mints tokens only for parties that don't have one) before retrying the same download. This mirrors the backend's decision to keep every `GET` here read-only (backend design §12).

`PartyDetailPage` also gained a standalone **Download Card** button next to Issue QR/Record Delivery, for the common case of printing right after issuing a token.

## 6. Application Architecture

- **Routing:** `react-router-dom` v6. `App.tsx` defines a flat route tree: `/login` outside auth, everything else behind `ProtectedRoute` and wrapped in a persistent `Layout` (sidebar nav + content area). Unauthenticated access to any protected route redirects to `/login`.
- **Layout:** a fixed left sidebar (`lucide-react` icons + `NavLink`) and a scrollable main content area capped at `max-w-6xl`. Sign-out is always reachable from the sidebar footer.
- **Component library (`src/components/index.tsx`):** a single file of shared primitives — `Button`, `Modal`, `Field`, `Input`, `TextArea`, `Select`, `Table<T>`, `Badge`, `PageHeader`, `Section`, `MediaPicker`, `LoadingSpinner`, `ErrorMessage` — plus two context-based providers, `ToastProvider`/`useToast` (transient success/error/info banners, auto-dismiss after 4s) and the auth context. Pages compose these rather than writing bespoke markup, keeping the feature pages visually consistent without a component framework dependency. `MediaPicker` (a `Select` of uploaded images plus a thumbnail preview) started as a local component in `SitePage.tsx` and was promoted here once the Invitations page needed the same picker with a JPEG/PNG-only `filter`.
- **Forms:** pages hold form state as plain `useState` objects and submit with a manual `onSubmit` handler that calls a mutation and reports errors via `useToast`. `react-hook-form` and `zod` are present in `package.json` but not currently used by any page — form shape is simple enough (a handful of controlled inputs per modal) that the extra layer hasn't been needed. Treat this as available, not mandatory, tooling.

## 7. State Management and Data Fetching

All server state lives in TanStack Query (`src/api/hooks.ts`); there is no separate client-side store (no Redux/Zustand). Conventions:

- One `use<Noun>()` query hook and one `use<Verb><Noun>()` mutation hook per resource, each with an explicit `queryKey`.
- Mutations invalidate the query keys they affect on success — e.g., creating a QR invitation invalidates `['parties']`; editing an RSVP (`useUpdateRsvp`) invalidates `['rsvps']` and `['parties']`, since a party's detail view depends on both.
- Two generic hooks, `useUpdateResource` and `useArchiveResource`, cover edit/archive for every simple lookup-style resource (venues, venue-rooms, venue-fees, site pages, things-to-do items, FAQ items, travel hotels/flights, etc.) via `PATCH /resources/{resource}/{id}` and `POST /resources/{resource}/{id}/archive`, rather than one bespoke hook per entity. Both invalidate all queries (`qc.invalidateQueries()`) since the affected resource can appear in several views at once. Site settings is the one exception: it's a singleton with no `id` in its URL, so it gets its own `useSiteSettings`/`useUpdateSiteSettings` pair against a dedicated `PATCH /internal/site/settings` endpoint.
- `useInvitationCards` (query key `['invitation-cards']`) backs the Invitations page's status table; `useIssueMissingInvitations` invalidates both that key and `['parties']` on success. PDF downloads themselves are plain async calls, not hooks — like CSV downloads, they're neither a query nor a mutation. `usePreviewInvitationCard` is a mutation with no cache entry (each call is a one-off render of unsaved state, nothing to invalidate or key by).
- Components read `data`/`isLoading`/`isPending` directly off the hook return value; there is no global loading indicator beyond each page's own `LoadingSpinner`.

## 8. API Integration

`src/api/client.ts` is the sole point of contact with the backend:

- A module-level (non-reactive) `_token` variable holds the bearer token; `api` methods attach `Authorization: Bearer <token>` when present. Keeping the token outside React state avoids re-renders on every request and keeps it out of anything that could serialize component state.
- A single `request<T>()` wrapper standardizes JSON/CSV/form-encoded requests, maps non-2xx responses to a typed `ApiRequestError` (carrying the backend's `code`/`message`), and special-cases `204 No Content` and `text/*` (CSV) responses. The token/401/error-envelope logic itself lives in a lower-level `rawRequest()` that returns the unread `Response`; `request<T>()`, `api.downloadBlob` (invitation-card PDF downloads), and `api.postBlob` (the Card Design live preview: POSTs a JSON body, reads the PDF response as a `Blob` for an `<iframe>` rather than triggering a file save) all build on it, so the paths can't drift.
- A registered `_onUnauthorized` callback (wired to `AuthContext.logout` in `AuthProvider`) fires on any `401`, so an expired or revoked token immediately drops the planner back to the login screen from wherever they were — no stale UI showing data the planner can no longer fetch.
- **Request-body key casing depends on the endpoint, and getting it wrong fails silently until submit.** Most writes (`createSimple`-backed POSTs, and every `PATCH /internal/resources/{resource}/{id}`) take snake_case keys matching SQL columns — this is also what every read endpoint returns, which makes it the easy default to reach for. But `POST /internal/parties`, `POST /internal/parties/{id}/guests`, and `POST /internal/events` bind to typed Java records and expect **camelCase** (`displayName`, `firstName`, `dressCode`, …); sending snake_case there passes a 400 (missing `@NotBlank` field) or 500 (unbound SQL parameter) straight to the toast, not a type error. `PartiesPage.handleCreate`, `PartyDetailPage.handleAddGuest`, and `EventsPage.submitEvent`'s create branch build camelCase bodies for exactly this reason — see `backend/SYSTEM_DESIGN.md` §5 for the backend-side rationale. When adding a call to a new POST endpoint, check whether the controller method takes a `record` or a raw `Map` before assuming snake_case.
- Errors are surfaced to the planner via `useToast().error(...)`, using `ApiRequestError.message` when available and a generic fallback otherwise; raw fetch/network errors are never shown unformatted.

## 9. Authentication and Session Management

- `AuthContext` also keeps the login response's `role` (`ADMIN`/`PLANNER`) in state, used only to hide admin-only affordances such as the guest-login **Unlock** button; the API is the enforcement point, so hiding a control is a UX nicety, never the access rule.
- The JWT returned by `POST /api/v1/auth/planner/login` is held only in memory (`AuthContext`, backed by a `useRef` plus a boolean `isAuthenticated` for render triggers) — never in `localStorage`, `sessionStorage`, or a cookie. A page refresh always returns to `/login`, matching the backend design's explicit simplicity tradeoff for a five-user internal tool (root design §8).
- Session length is bounded by the backend's 8-hour planner token expiry; the frontend does not track or pre-emptively refresh it — it simply reacts to the eventual `401`.
- Because the token never touches persistent storage, there is nothing for the frontend to clear beyond in-memory state on logout; there is correspondingly nothing to leak via XSS-readable storage.

## 10. Non-Functional Requirements

- Optimize for planner clarity and error-recoverability over raw performance or offline resilience — this mirrors the backend's stated priorities (root design §9) for a low-volume internal tool.
- Every list/detail page must have an explicit loading state and an explicit empty state (`Table`'s `emptyMessage`); neither should ever render as a blank area.
- Every mutation must produce a toast on both success and failure; a planner should never be left wondering whether a click did anything.
- Capacity-override and archive actions require an extra confirmation step (checkbox or `confirm()`) since they are the two classes of action most likely to cause a data problem a planner didn't intend.
- No client-side pagination/virtualization is required at current scale (~200 guests, ~5 planners); list endpoints are fetched in full pages (e.g., `size=100`) rather than incrementally.

## 11. Technology and Deployment

- **Framework:** React 18 + TypeScript, built with Vite.
- **Styling:** Tailwind CSS utility classes; no component-styling library beyond the shared primitives in `src/components/index.tsx`.
- **Data/server state:** `@tanstack/react-query` v5.
- **Routing:** `react-router-dom` v6.
- **Icons:** `lucide-react`.
- **Type checking as CI gate:** `npm run build` runs `tsc` before `vite build`, so a type error fails the build outright.
- **Local dev:** `npm run dev` serves on `:3000` and proxies `/api` to `INTERNAL_UI_API_BASE_URL` (default `http://localhost:8080`) per `vite.config.ts`.
- **Production (local Compose):** multi-stage `Dockerfile` — `npm ci && npm run build` in a Node build stage, then the static `dist/` output is served by `nginx:1.27-alpine` (`nginx.conf`), which also reverse-proxies `/api/` to the `api` service inside the compose network and falls back unmatched routes to `index.html` for client-side routing.
- **Production (deployed):** built with `VITE_API_BASE_URL` set to the API's public hostname and deployed to Firebase Hosting (`firebase.json`, `planner` target) — see root `SYSTEM_DESIGN.md` §10. `nginx.conf`/`Dockerfile` above remain the Compose-dev path only; Firebase serves the same `dist/` output with its own SPA rewrite instead of nginx's `try_files`.
- **Sibling app:** `frontend/public/` is the separately-deployed guest-facing site (`web-public` in compose, port 3001) — same stack and build shape, but its own package with its own `SYSTEM_DESIGN.md`; the two apps share no code.

## 12. Design Decisions and Edge Cases

- **No client-side source of truth for business rules.** Capacity and RSVP-deadline enforcement live entirely in the backend; the frontend only reflects what the API returns and surfaces whatever error the API sends back. This avoids the two copies of a rule ever disagreeing.
- **In-memory-only auth token** (see §9) is a deliberate, documented tradeoff, not an oversight — re-litigating it should start from the backend design's rationale, not from "add localStorage."
- **Generic resource endpoints over one-off hooks.** `useUpdateResource`/`useArchiveResource` intentionally take a `resource` string rather than being generated per entity; new simple lookup-style resources (e.g., a future venue amenity list) should reuse them instead of adding new hooks, unless the resource needs bespoke request/response shaping.
- **CSV import/export as the integration surface**, not inline editing of bulk data — guest import via CSV, and every report as a CSV download — keeps the UI from needing spreadsheet-like bulk-edit affordances the planner team hasn't asked for.
- **Overbooking requires an explicit, visually distinct opt-in** in the Accommodations UI; this is the one place the frontend adds friction beyond what a naive CRUD form would, because the backend records it as an audited action (root design §11).
- **A detail page, not a third Events-page tab, for venue cost.** `VenueDetailPage` follows `PartyDetailPage`'s nested-list shape (parent facts + child tables with their own add/edit modals) rather than cramming room rates and fees into the already-tabbed `/events` page — two more nested lists didn't fit that layout, and the pattern was already established for parties/guests.
- **The guest room dropdown is not the Accommodations assignment flow.** `Guest.room_assignment_id` (edited from the guest form) is a lightweight planning-stage pointer straight at a `VenueRoom`, independent of the `AccommodationAssignment` records created on the Accommodations page (dates, status, capacity-checked). The two can disagree; this mirrors a deliberate backend decision (backend design §12) and is worth knowing before "fixing" it into one flow.
- **Properties and Rooms tabs were removed from the Accommodations page.** A venue is now the lodging property too (backend design §12), so `VenueDetailPage`'s Rooms table is the one place room inventory gets entered; the Accommodations page kept only Assignments and Change Requests, which stay cross-venue (the dashboard links here for the open-change-request count, and a rooming list needs to span every venue, not one at a time).
