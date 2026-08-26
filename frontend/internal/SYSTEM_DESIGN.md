# Wedding Planner Internal Tool — System Design

## 1. Overview

This is the planner-facing web application for the wedding-planning system described in the root [`SYSTEM_DESIGN.md`](../../SYSTEM_DESIGN.md). It is a React single-page application used by approximately five planners to manage guests, events, RSVPs, accommodations, budget, and the public wedding site's content for a wedding held in Nepal. It is a thin client: all business rules, validation, and authorization are enforced by the backend API (`backend/`); this application's job is to present that data and collect planner input safely and efficiently.

In Docker, the app is built into static assets and served by Nginx, which also reverse-proxies `/api` to the backend service. In local development, the Vite dev server proxies `/api` to `http://localhost:8080`, so the app never needs to know the backend's real origin.

## 2. Goals and Success Criteria

The tool lets five planners jointly manage the wedding's guest list, schedule, RSVPs, accommodations, and budget from day-to-day without needing direct database or API access.

Success means that:

- A planner can perform every action in the backend's functional requirements (§5.1–§5.6 of the root design) without leaving the browser.
- Destructive or high-consequence actions (archiving, capacity overrides) are deliberate — never a single accidental click — and are traceable back to the backend's audit trail.
- The app fails predictably: a network error, expired session, or validation error always produces a legible message, never a silent failure or a blank screen.

## 3. Scope

### In scope

- Planner authentication and session handling.
- CRUD and status-management screens for parties/guests, invitations, events/venues, RSVPs, accommodations, change requests, and budget.
- CSV-based bulk guest import and CSV report downloads.
- Printable invitation card management: card artwork/text design and PDF downloads, single or bulk (§5.10).
- Client-side surfacing of backend validation and authorization errors.
- Public wedding site content management: site-wide settings, per-tab visibility toggles, things-to-do items, and image uploads (§5.9).

### Out of scope

- Any business logic that duplicates or bypasses backend validation (e.g., computing RSVP eligibility or capacity client-side as a source of truth).
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
- Create/edit parties and guests; issue a QR invitation token for a party; record manual invitation delivery (with an optional note).
- Bulk guest import via CSV upload (`postForm` to `/guests/import`), reporting parties/guests created; a blank import template is downloadable from Reports (§5.7).

### 5.4 Events & Venues (`/events`)

Create and edit events (name, venue, timing, dress code, capacity, RSVP deadline) and venues (pricing, capacity, scores, contact info). Adding a party as event-eligible auto-creates its RSVPs on the backend, so this page invalidates the `rsvps` query on success.

### 5.5 RSVPs (`/rsvps`)

A filterable table (by event) of per-guest, per-event RSVP status, with manual status override and a free-text source/note field for phone or in-person responses recorded on a guest's behalf.

### 5.6 Accommodations (`/accommodations`)

A tabbed workspace: Properties, Rooms, Assignments, and Change Requests (the tab label carries an open-request count badge). Assignments support an explicit **"Override capacity limit"** checkbox, styled distinctly (yellow, called out as audited) so a planner cannot overbook a room without a visible, deliberate action. Change requests can be resolved or declined inline; only planners change actual assignments, per root design §5.4.

### 5.7 Budget (`/budget`)

Manage budget categories, contributors, and line items (currency, planned/actual amount, payment status, due date), plus a planned-vs-actual summary view by category.

### 5.8 Reports (`/reports`)

One-click CSV downloads for attendance, dietary/accessibility, rooming list, and budget summary, plus the blank guest-import template. Downloads are triggered client-side via `api.downloadCsv`, which fetches the CSV as text and saves it through an in-memory `Blob`/`URL.createObjectURL` — no server-side redirect or new tab.

### 5.9 Wedding Site (`/site`)

A tabbed workspace mirroring the Budget/Accommodations pattern:

- **Content:** a single form over the site-settings singleton — partner names, wedding date, display timezone, hero image (via the media picker), tagline, and per-tab heading/body copy for Home, Schedule, Travel, and Things To Do. Travel's body is the entire Travel tab's content — a single multi-line text box, no structured item records.
- **Pages:** a table of every public-site tab (including the ones not yet built a dedicated page for) with a Show/Hide toggle and an edit modal for label, sort order, and body text. This is the control that turns on a future tab (Our Story, FAQ, etc.) with no code change — see root design §12.
- **Things To Do:** create/edit/archive for things-to-do items (category, title, description, photo), grouped by category on the public site. Category is free text rather than a fixed enum, so planners can define whatever groupings fit their recommendations.
- **Media:** upload and browse images; the same list backs the media picker used by the Content and Things To Do tabs.

The Events page (`/events`) also gained a **"Show on wedding site Schedule tab"** checkbox — `event.public_visible`, independent of RSVP eligibility (root design §5.8, backend design §12).

### 5.10 Invitations (`/invitations`)

The one screen `PartyDetailPage`'s QR modal doesn't cover: a party-by-party view of invitation/card status plus the printable-card workflow.

- **Card Design:** a form over four new `site_settings` fields — artwork (via the shared `MediaPicker`, filtered to JPEG/PNG since the backend can't embed WEBP in a PDF), headline, body, and footer caption — saved through the existing `useUpdateSiteSettings`.
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
- Mutations invalidate the query keys they affect on success — e.g., creating a QR invitation invalidates `['parties']`; adding an event-eligible party invalidates `['rsvps']`; creating a budget line item invalidates both `['budget-line-items']` and `['budget-summary']`.
- Two generic hooks, `useUpdateResource` and `useArchiveResource`, cover edit/archive for every simple lookup-style resource (properties, rooms, budget categories, site pages, things-to-do items, etc.) via `PATCH /resources/{resource}/{id}` and `POST /resources/{resource}/{id}/archive`, rather than one bespoke hook per entity. Both invalidate all queries (`qc.invalidateQueries()`) since the affected resource can appear in several views at once. Site settings is the one exception: it's a singleton with no `id` in its URL, so it gets its own `useSiteSettings`/`useUpdateSiteSettings` pair against a dedicated `PATCH /internal/site/settings` endpoint.
- `useInvitationCards` (query key `['invitation-cards']`) backs the Invitations page's status table; `useIssueMissingInvitations` invalidates both that key and `['parties']` on success. PDF downloads themselves are plain async calls, not hooks — like CSV downloads, they're neither a query nor a mutation.
- Components read `data`/`isLoading`/`isPending` directly off the hook return value; there is no global loading indicator beyond each page's own `LoadingSpinner`.

## 8. API Integration

`src/api/client.ts` is the sole point of contact with the backend:

- A module-level (non-reactive) `_token` variable holds the bearer token; `api` methods attach `Authorization: Bearer <token>` when present. Keeping the token outside React state avoids re-renders on every request and keeps it out of anything that could serialize component state.
- A single `request<T>()` wrapper standardizes JSON/CSV/form-encoded requests, maps non-2xx responses to a typed `ApiRequestError` (carrying the backend's `code`/`message`), and special-cases `204 No Content` and `text/*` (CSV) responses. The token/401/error-envelope logic itself lives in a lower-level `rawRequest()` that returns the unread `Response`; `request<T>()` and `api.downloadBlob` (added for invitation-card PDFs, since binary responses can't go through `res.json()`/`res.text()`) both build on it, so the two paths can't drift.
- A registered `_onUnauthorized` callback (wired to `AuthContext.logout` in `AuthProvider`) fires on any `401`, so an expired or revoked token immediately drops the planner back to the login screen from wherever they were — no stale UI showing data the planner can no longer fetch.
- **Request-body key casing depends on the endpoint, and getting it wrong fails silently until submit.** Most writes (`createSimple`-backed POSTs, and every `PATCH /internal/resources/{resource}/{id}`) take snake_case keys matching SQL columns — this is also what every read endpoint returns, which makes it the easy default to reach for. But `POST /internal/parties`, `POST /internal/parties/{id}/guests`, and `POST /internal/events` bind to typed Java records and expect **camelCase** (`displayName`, `firstName`, `dressCode`, …); sending snake_case there passes a 400 (missing `@NotBlank` field) or 500 (unbound SQL parameter) straight to the toast, not a type error. `PartiesPage.handleCreate`, `PartyDetailPage.handleAddGuest`, and `EventsPage.submitEvent`'s create branch build camelCase bodies for exactly this reason — see `backend/SYSTEM_DESIGN.md` §5 for the backend-side rationale. When adding a call to a new POST endpoint, check whether the controller method takes a `record` or a raw `Map` before assuming snake_case.
- Errors are surfaced to the planner via `useToast().error(...)`, using `ApiRequestError.message` when available and a generic fallback otherwise; raw fetch/network errors are never shown unformatted.

## 9. Authentication and Session Management

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
- **Production:** multi-stage `Dockerfile` — `npm ci && npm run build` in a Node build stage, then the static `dist/` output is served by `nginx:1.27-alpine` (`nginx.conf`), which also reverse-proxies `/api/` to the `api` service inside the compose network and falls back unmatched routes to `index.html` for client-side routing.
- **Sibling app:** `frontend/public/` is the separately-deployed guest-facing site (`web-public` in compose, port 3001) — same stack and build shape, but its own package with its own `SYSTEM_DESIGN.md`; the two apps share no code.

## 12. Design Decisions and Edge Cases

- **No client-side source of truth for business rules.** Capacity, eligibility, and RSVP-deadline enforcement live entirely in the backend; the frontend only reflects what the API returns and surfaces whatever error the API sends back. This avoids the two copies of a rule ever disagreeing.
- **In-memory-only auth token** (see §9) is a deliberate, documented tradeoff, not an oversight — re-litigating it should start from the backend design's rationale, not from "add localStorage."
- **Generic resource endpoints over one-off hooks.** `useUpdateResource`/`useArchiveResource` intentionally take a `resource` string rather than being generated per entity; new simple lookup-style resources (e.g., a future venue amenity list) should reuse them instead of adding new hooks, unless the resource needs bespoke request/response shaping.
- **CSV import/export as the integration surface**, not inline editing of bulk data — guest import via CSV, and every report as a CSV download — keeps the UI from needing spreadsheet-like bulk-edit affordances the planner team hasn't asked for.
- **Overbooking requires an explicit, visually distinct opt-in** in the Accommodations UI; this is the one place the frontend adds friction beyond what a naive CRUD form would, because the backend records it as an audited action (root design §11).
