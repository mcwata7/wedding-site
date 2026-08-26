# Wedding Guest Site — System Design

## 1. Overview

This is the guest-facing public wedding site for the system described in the root [`SYSTEM_DESIGN.md`](../../SYSTEM_DESIGN.md). It is a React single-page application used by the ~200 invited guests to view the wedding's Home, Schedule, and Travel pages. Its first release ships those three tabs; the remaining Zola-style tabs (Our Story, Wedding Party, Photos, Things to Do, FAQ, Registry, RSVP) exist as content rows a planner can make visible from the internal tool with no code change — see `frontend/internal/SYSTEM_DESIGN.md` §5.9. Like the planner app, it is a thin client: content and business rules (event eligibility, visibility) live entirely in the backend API (`backend/`); this app presents that data and handles the guest verification handshake.

In Docker, the app is built into static assets and served by Nginx, which also reverse-proxies `/api` to the backend service. In local development, the Vite dev server proxies `/api` to `http://localhost:8080`.

## 2. Goals and Success Criteria

The site lets any of the ~200 invited guests, most of whom will visit briefly and infrequently from a phone, find the wedding's schedule and travel information without contacting a planner directly.

Success means that:

- A guest reaches their content by scanning their invitation's QR code or typing its code, answers one verification question, and immediately sees Home/Schedule/Travel.
- The site never shows a guest anything about another party — no RSVP data, no other party's info — since it renders only public-facing content plus the guest's own eligible schedule.
- A planner can change any piece of copy, the hero image, travel entries, or which tabs are visible without a deploy.

## 3. Scope

### In scope

- Guest QR-token verification and session handling.
- Home, Schedule, and Travel pages, all sourced from planner-editable backend content.
- Generic rendering of any additional site page a planner marks visible.
- Client-side surfacing of backend errors (invalid code, wrong answer, expired session).

### Out of scope

- Any RSVP, accommodation, or party-management functionality — those remain guest-API features not yet built into this site (see root design §5.8 for what's planned).
- Any business logic that duplicates backend rules (event eligibility, visibility) as a client-side source of truth.
- The planner-facing application (separate frontend, email/password auth, not covered here).
- Offline support or a native/mobile client.

## 4. Users and Roles

There is a single user type: **Guest**, scoped to their own invitation party by the backend (root design §4, §8). The frontend has no role gating of its own beyond "has a valid session or not" — `GuestRoute` is a UX convenience, not a security boundary; every actual authorization check happens server-side against the JWT's `partyId`.

## 5. Functional Requirements

Each item corresponds to a route in `src/App.tsx` and a page in `src/pages/`.

### 5.1 Invitation entry (`/i/:qrToken`, `/unlock`)

- `/i/:qrToken` is the QR code's target: it stashes the token in `sessionStorage` and redirects to `/unlock`. A guest can also land on `/unlock` directly and type their code.
- `/unlock` is a two-step form: `POST /api/v1/guest/invitations/lookup` (unauthenticated — shows the party's name and verification question) followed by `POST /api/v1/guest/sessions` (QR token + answer → JWT). On success, the token is handed to `GuestAuthContext` and the guest is routed home.

### 5.2 Home (`/`)

Hero image, both partners' names, the wedding date, an optional tagline, and free-form heading/body copy — all from `GET /api/v1/guest/site/config`'s `settings` object. Renders a placeholder tint if no hero image has been uploaded yet, never a broken image.

### 5.3 Schedule (`/schedule`)

A chronological list of the events the guest's party is both eligible for (`event_eligibility`) and that the planner has marked public (`event.public_visible`) — `GET /api/v1/guest/site/schedule`. Each entry shows date, time range, venue, dress code, and description, formatted in the wedding's configured `display_timezone` rather than a hardcoded one (contrast with the planner app, which hardcodes `Asia/Kathmandu` — see `frontend/internal/src/lib/format.ts`).

### 5.4 Travel (`/travel`)

Planner-entered travel items — `GET /api/v1/guest/site/travel` — grouped into four fixed categories (Getting Here / Where to Stay / Getting Around / Good to Know) by their `kind`, each rendered as a card with optional image, address, phone, and outbound link.

### 5.5 Other pages (`/:slug`)

Any `site_page` beyond home/schedule/travel that a planner has marked visible renders through a single generic `ContentPage`: page label as a heading, `body` as plain text. A slug that isn't visible (or doesn't exist) redirects home rather than 404ing.

## 6. Application Architecture

- **Routing:** `react-router-dom` v6. `/i/:qrToken` and `/unlock` are public; everything else sits behind `GuestRoute`, which redirects to `/unlock` when unauthenticated, wrapped in a `Layout` that renders a centered nav bar built from `GET /api/v1/guest/site/config`'s `pages` list — so the visible tabs (and their order) always match what the planner configured, with no separate nav config to keep in sync.
- **Layout:** mobile-first, unlike the planner app's fixed-sidebar desktop layout — a sticky top nav and a single centered column (`max-w-3xl`) that scales down to a 375px viewport.
- **Component library (`src/components/index.tsx`):** a small subset of the planner app's primitives — `ToastProvider`/`useToast`, `LoadingSpinner`, `ErrorMessage`, `PageHeading` — trimmed to what a read-mostly, unauthenticated-by-default app actually needs (no `Table`, `Modal`, or form inputs beyond what `UnlockPage` uses inline).
- **Forms:** the only forms are the two-step unlock flow; both use plain `useState`, matching the planner app's convention. `react-hook-form`/`zod` are intentionally not installed here (they're unused dead weight even in the planner app — see its design doc §6).

## 7. State Management and Data Fetching

All server state lives in TanStack Query (`src/api/hooks.ts`), same as the planner app:

- `useSiteConfig`, `useSchedule`, `useTravel` — one query hook per `GET /api/v1/guest/site/*` endpoint, no mutations (this app never writes).
- No query invalidation is needed since nothing here mutates server state; `staleTime: 30_000` (set globally in `main.tsx`) is enough to avoid refetching on every tab switch within a session.
- `siteMediaUrl(id)` is a small helper, not a hook, that turns a `media_asset` id into `/api/v1/media/{id}` — the same unauthenticated image-read endpoint the planner app's media picker uses.

## 8. API Integration

`src/api/client.ts` mirrors the planner app's `client.ts` almost exactly (same `request<T>()` wrapper, same `ApiRequestError`, same `401` → `onUnauthorized` hook) with two differences: no `downloadCsv` (nothing here is exportable), and the unauthorized message reads "Please verify again" rather than "log in again," matching the guest vocabulary (there's no concept of a login screen here, only the verification handshake).

## 9. Authentication and Session Management

- The JWT returned by `POST /api/v1/guest/sessions` is stored in `sessionStorage` (`GuestAuthContext`), **not** kept memory-only like the planner app's token. This is a deliberate, documented deviation from the planner app's pattern (root design §5.8, §10): guest content is low-sensitivity (schedule/travel, not PII), guests are overwhelmingly on mobile where tab/app switches reload the page, and re-answering a verification question on every navigation would be poor UX for a 2-hour-lived token that's supposed to last a browsing session.
- Session length is bounded by the backend's 2-hour guest token expiry (`wedding.security.guest-session-minutes`); the frontend does not refresh it — an expired token surfaces as a `401` → `GuestAuthContext.logout()` → redirect to `/unlock`.
- `sessionStorage` (not `localStorage`) means the session still doesn't survive closing the tab/app, capping how long a lost or shared device stays authenticated.

## 10. Non-Functional Requirements

- Mobile-first by default (root design §9 doesn't distinguish devices, but the guest audience skews heavily toward phones checking a wedding site) — verified at a 375px viewport.
- Every page has an explicit loading state (`LoadingSpinner`) and an explicit error state (`ErrorMessage`); no page ever renders a blank area while data is missing.
- No client-side pagination or virtualization — schedule and travel lists are small (a handful of events/items per wedding) and fetched in full.
- Self-contained styling: no webfont network dependency (`fontFamily.display` uses a system serif stack), consistent with keeping the guest experience fast on mobile data.

## 11. Technology and Deployment

- **Framework:** React 18 + TypeScript, built with Vite.
- **Styling:** Tailwind CSS utility classes with a small custom palette/font extension (`tailwind.config.ts`) — unlike the planner app's empty `theme.extend`, since this app's visual identity (a wedding site, not an admin tool) actually needs one.
- **Data/server state:** `@tanstack/react-query` v5.
- **Routing:** `react-router-dom` v6.
- **Icons:** `lucide-react` (installed for consistency with the planner app; not currently used by any page).
- **Type checking as CI gate:** `npm run build` runs `tsc` before `vite build`, same convention as the planner app.
- **Local dev:** `npm run dev` serves on `:3001` and proxies `/api` to `PUBLIC_UI_API_BASE_URL` (default `http://localhost:8080`) per `vite.config.ts`.
- **Production:** multi-stage `Dockerfile` — `npm ci && npm run build`, then `nginx:1.27-alpine` serves `dist/` and reverse-proxies `/api/` to the `api` service (`nginx.conf`), falling back unmatched routes to `index.html`. Compose service name `web-public`, host port `3001`.

## 12. Design Decisions and Edge Cases

- **`sessionStorage` over memory-only auth** (see §9) — the one deliberate divergence from the planner app's session pattern, driven by a different threat/UX tradeoff (low-sensitivity content, mobile-heavy audience) rather than an oversight.
- **Nav driven entirely by backend config**, not a hardcoded route list — adding/hiding a tab is a planner action (`site_page.visible`), not a frontend change. `/:slug` catches anything the nav can produce that isn't one of the three hand-built pages.
- **No client-side source of truth for eligibility or visibility.** The Schedule page trusts `GET /api/v1/guest/site/schedule` completely — it doesn't re-derive which events to show from any other data the app might have cached.
- **Separate app, not a mode of the planner app.** Different auth model (QR/verification vs. email/password), different audience (200 casual mobile visitors vs. 5 power users), and different failure tolerance (a guest should never see an internal error code) justified a fully separate package rather than a shared codebase with route-based mode switching.
