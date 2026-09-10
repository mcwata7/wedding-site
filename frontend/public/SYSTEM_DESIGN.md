# Wedding Guest Site — System Design

## 1. Overview

This is the guest-facing public wedding site for the system described in the root [`SYSTEM_DESIGN.md`](../../SYSTEM_DESIGN.md). It is a React single-page application used by the ~200 invited guests to view the wedding's Home, Schedule, Travel, Things to Do, and FAQ pages. RSVP exists as a content row a planner can make visible from the internal tool with no code change — see `frontend/internal/SYSTEM_DESIGN.md` §5.9. Like the planner app, it is a thin client: content and business rules (event visibility) live entirely in the backend API (`backend/`); this app presents that data and handles the guest verification handshake.

A planner chooses between two presentations of that same content via `site_settings.site_layout`: **multi-page** (`MULTI_PAGE`, the original design — each tab its own route) or **single-page** (`SINGLE_PAGE` — every tab an anchored section on `/`, reached by clicking a header item). RSVP is always its own route in either layout. See §5.8 and §6.

A planner can also restyle the site (header/site font, color, size, background — §5.9) and replace the entire Home page with one designed image (§5.10), both without a deploy.

In Docker, the app is built into static assets and served by Nginx, which also reverse-proxies `/api` to the backend service. In local development, the Vite dev server proxies `/api` to `http://localhost:8080`.

## 2. Goals and Success Criteria

The site lets any of the ~200 invited guests, most of whom will visit briefly and infrequently from a phone, find the wedding's schedule and travel information without contacting a planner directly.

Success means that:

- A guest reaches their content by typing their own name, answers one verification question, and immediately sees Home/Schedule/Travel.
- The site never shows a guest anything about another party — no RSVP data, no other party's info — since it renders only public-facing content plus the (shared) public schedule.
- A planner can change any piece of copy, the hero image, travel entries, which tabs are visible, or the site's overall layout (multi-page vs. single-page) without a deploy.

## 3. Scope

### In scope

- Guest QR-token verification and session handling.
- Home, Schedule, Travel, Things to Do, and FAQ pages, all sourced from planner-editable backend content.
- Generic rendering of any additional site page a planner marks visible.
- Client-side surfacing of backend errors (invalid code, wrong answer, expired session).

### Out of scope

- Any RSVP, accommodation, or party-management functionality — those remain guest-API features not yet built into this site (see root design §5.8 for what's planned).
- Any business logic that duplicates backend rules (event visibility) as a client-side source of truth.
- The planner-facing application (separate frontend, email/password auth, not covered here).
- Offline support or a native/mobile client.

## 4. Users and Roles

There is a single user type: **Guest**, scoped to their own invitation party by the backend (root design §4, §8). The frontend has no role gating of its own beyond "has a valid session or not" — `GuestRoute` is a UX convenience, not a security boundary; every actual authorization check happens server-side against the JWT's `partyId`.

## 5. Functional Requirements

Each item corresponds to a route in `src/App.tsx` (multi-page mode) or a section of `src/pages/OnePage.tsx` (single-page mode) and a page component in `src/pages/`. §5.2–§5.6 describe each page's content, which is identical in both layouts — only whether it's reached by URL path or by scrolling to an anchor differs (§6).

### 5.1 Invitation entry (`/unlock`)

- `/unlock` is a two-step form: `POST /api/v1/guest/invitations/lookup` (unauthenticated — takes the guest's own name, returns the party's name and verification question) followed by `POST /api/v1/guest/sessions` (name + answer → JWT). On success, the token is handed to `GuestAuthContext` and the guest is routed home. A "Not you?" link returns to step one.
- Wrong answers are rate-limited and eventually lock the party out (backend design §5); both steps of the form surface the backend's message verbatim, so a guest sees "try again in 5 minutes" or "contact the couple to have it unlocked" rather than a generic failure. A locked party is caught at the name step too, so nobody types an answer that was never going to be checked.
- Entry is by **name**, not by invitation code: guests type their own name, which the backend maps to their guest row and hence their party. The name is not the credential — the party's verification answer is (see `backend/SYSTEM_DESIGN.md` §5). An ambiguous name (matching two parties) is rejected with a prompt for the full name rather than resolved by guessing.
- `/i/*` (the URL printed on already-mailed invitation cards) now just redirects to `/unlock`; the invitation token is no longer an entry credential.

### 5.2 Home (`/`)

Hero image and tagline from `GET /api/v1/guest/site/config`'s `settings` object (site-wide identity, not one tab's copy), both partners' names, a wedding date **range** (`wedding_start_date`/`wedding_end_date` — rendered as a single date via `fmtDateRange` when the two are equal or the end date is unset), and the `home` `site_page` row's `heading`/`body` (looked up from `config.pages` by slug via `usePageContent('home')`). Renders the branded temple-illustration backdrop (see §6) if no hero image has been uploaded yet, never a broken image. If `settings.home_design_only` is set and `settings.home_design_image_id` is uploaded, none of the above renders — see §5.10.

### 5.3 Schedule (`/schedule`)

An optional planner-set banner image and heading/body (the `schedule` `site_page` row, via `usePageContent('schedule')`), then a chronological list of every event the planner has marked public (`event.public_visible`) — every party attends every event, so there's no per-party filter beyond that — `GET /api/v1/guest/site/schedule`. Each entry shows date, time range, venue, dress code, and description, formatted in the wedding's configured `display_timezone` rather than a hardcoded one (contrast with the planner app, which hardcodes `Asia/Kathmandu` — see `frontend/internal/src/lib/format.ts`).

### 5.4 Travel (`/travel`)

An optional planner-set banner image and heading/body (the `travel` `site_page` row), then two planner-curated lists from `GET /api/v1/guest/site/travel` (`{hotels, flights}`): **Hotels** (name, address, description, and a link out to the hotel's site) and **Flights** (route name, duration, estimated cost, description). Either section renders nothing when its list is empty, so a planner who's only filled in one still gets a clean page.

### 5.5 Things To Do (`/things-to-do`)

An optional planner-set banner image and heading/body (the `things-to-do` `site_page` row), then planner-curated recommendations — `GET /api/v1/guest/site/things-to-do` — grouped by category, each card showing an optional photo, title, and description.

### 5.6 FAQ (`/faq`)

An optional planner-set banner image and heading/body (the `faq` `site_page` row), then a planner-curated list of question/answer pairs — `GET /api/v1/guest/site/faq`.

### 5.7 Other pages (`/:slug`)

Any `site_page` without a dedicated page component (currently just RSVP) that a planner has marked visible renders through a single generic `ContentPage`: an optional banner image (`site_page.image_id`), `heading` (falling back to `label`) as the page title, `body` as plain text. A slug that isn't visible (or doesn't exist) redirects home rather than 404ing. In single-page mode this same component renders inline as a section (`ContentPage` accepts an optional `slug` prop for this) instead of at its own route.

### 5.8 Site layout toggle (`site_settings.site_layout`)

- **`MULTI_PAGE`** (default): §5.2–§5.7 as originally designed, one route each.
- **`SINGLE_PAGE`**: `/` renders `OnePage.tsx`, which composes §5.2–§5.6's page components (unmodified — same hooks, same loading/error handling) into `<Section>` wrappers, in the planner's `sort_order`, separated by the existing `.temple-divider` rule. RSVP is excluded from this composite and stays routed (`ROUTED_SLUGS` in `src/api/hooks.ts`) — it's the one page a guest submits through rather than just reads, and a form mid-scroll fights the anchor model the rest of the site uses here. A legacy path like `/travel` redirects to `/#travel` (`SectionRedirect` in `App.tsx`) rather than 404ing, so an old link or bookmark still works.
- Edited on the planner UI's Site → General tab (`frontend/internal/SYSTEM_DESIGN.md` §5.9). An unrecognized value (a bundle built against an older API, or vice versa) is treated as `MULTI_PAGE` — see `useSiteLayout()` in `src/api/hooks.ts`.

### 5.9 Site-wide styling

Ten `site_settings` columns, all nullable (null = today's built-in look), let a planner
restyle the site without a deploy — edited on the planner UI's Site → General tab
(`frontend/internal/SYSTEM_DESIGN.md` §5.9):

- **Header** (the sticky nav bar only, not page titles): `header_font_family`,
  `header_font_color`, `header_font_size` (`SMALL`/`MEDIUM`/`LARGE`), `header_bg_color`.
- **Site** (everything else — body text and page headings/titles): the same four fields
  with a `site_` prefix. Font family applies to headings/page titles only (`PageHeading`,
  the Home hero's couple-names text) — body paragraphs always stay in the default sans
  stack, since the 10 available fonts (below) are decorative script faces unsuited to
  long-form reading.
- Font family is one of 10 curated fonts bundled as static assets (`public/fonts/*.ttf`,
  `@font-face` in `index.css`) — Tangerine, Rouge Script, Monsieur La Doulaise, Gwendolyn,
  Ephesis, Lavishly Yours, Oooh Baby, Carattere, Birthstone, Bilbo Swash Caps. Not a
  planner-uploaded set: these are a fixed catalog, so there's no media-upload/backend
  involvement, just a font *key* stored in the settings column. See `src/lib/theme.ts`'s
  `FONT_FAMILIES` map (kept in sync with the backend's `SITE_FONTS` validation set and the
  planner UI's own copy of the label list) and §6/§12 for the CSS mechanics.
- **Tile** (the individual cards on Schedule, Travel, and Things To Do — each event, hotel,
  flight, and recommendation, which all share one look): `tile_bg_color`, `tile_border_color`.
  No font/size fields — tile text already follows the Site styling above. See §6 for how
  these plug into the same `tileBg`/`tileBorder` Tailwind tokens every tile's markup uses.

### 5.10 Home page "fully designed image" override

A planner can design the Home page entirely outside the app and upload it as one image
(`settings.home_design_image_id`, via the same `MediaPicker`/upload flow as the hero
image), then check `settings.home_design_only` to make the guest Home page render
*only* that image — no hero, no overlay text, no heading/body. Every other Home field
(heading, body, hero image/tagline, partner names, dates) stays editable and stored, it
just stops rendering while the flag is on. If the flag is on but no image is set yet,
§5.2's normal composition still renders (toggling the checkbox before uploading never
blanks the page). In `SINGLE_PAGE` layout the design image simply becomes `OnePage`'s
first section, with Schedule/Travel/FAQ still following below it — this is deliberate:
it overrides the *Home page's* content, not the whole site's layout.

## 6. Application Architecture

- **Routing:** `react-router-dom` v6. `/unlock` (and the `/i/*` redirect) is public; everything else sits behind `GuestRoute`, which redirects to `/unlock` when unauthenticated, wrapped in a single `Layout` that renders a centered nav bar built from `GET /api/v1/guest/site/config`'s `pages` list — so the visible tabs (and their order) always match what the planner configured, with no separate nav config to keep in sync. `Layout`'s header shell is identical in both site layouts; only its inner `<Routes>` table and each nav item's target switch on `useSiteLayout()` (`MULTI_PAGE`'s table is exactly what's described in §5.1–§5.7; `SINGLE_PAGE`'s is `index → OnePage`, `rsvp → ContentPage`, `* → SectionRedirect`). `Layout` gates its children behind the site config's own `isLoading` so the correct route table is never chosen from a stale default.
- **Single-page nav (`App.tsx`'s `NavItem`):** a routed slug (multi-page mode, or `rsvp` in either mode) is today's `NavLink`; a single-page section is a `<Link to={{ pathname: '/', hash: '#slug' }}>` — a real link so middle-click/copy-link work — with the actual scrolling done by `useHashScroll` (`src/lib/scroll.ts`), not the click handler itself, so there's one scroll mechanism instead of two that could disagree. Active-item highlighting comes from `useActiveSection`'s `IntersectionObserver` in this mode, since `NavLink`'s own `isActive` never fires for an anchor.
- **Hash scrolling (`src/lib/scroll.ts`):** the browser's native anchor scroll (and React Router) never scroll for us here, since `OnePage`'s sections don't exist in the DOM until its queries resolve. `useHashScroll(ready)` re-checks the current hash whenever it changes or `ready` flips true, and scrolls to the matching `id`. The first time a mount becomes `ready` is treated as an *arrival* (instant jump — covers a cold deep link and the `/travel → /#travel` redirect, so the page doesn't animate past every section to reach its target); any hash change after that (a nav click, back/forward while still mounted) scrolls smoothly, respecting `prefers-reduced-motion`. The hash is never rewritten while scrolling (see §12) — only an explicit nav click changes it.
- **Layout:** mobile-first, unlike the planner app's fixed-sidebar desktop layout — a sticky top nav and a single centered column (`max-w-3xl`) that scales down to a 375px viewport.
- **Nav overflow (`.nav-scroll` in `src/index.css` + `useOverflowFade`):** the nav row centers while every item fits and scrolls horizontally once they don't — which on a 375px phone is the normal case, since six script-font tabs exceed the width. It uses `justify-content: safe center` rather than plain `center`: `center` also centers the *overflowing* line, putting the first and last item beyond the scrollport's reachable range (a guest saw "Home" clipped and could not scroll it back into view), while `safe` falls back to start-alignment exactly when overflow occurs and leaves the centered desktop case untouched. The scrollbar is hidden and replaced by a mask-image fade on whichever edge still has items past it, driven by `useOverflowFade` (`src/lib/scroll.ts`, recomputed on scroll, `ResizeObserver`, and `document.fonts.ready` — a late-swapping script face changes the overflow boundary without changing the element's box).
- **Visual theme:** a Kathmandu Newari-temple palette (`tailwind.config.ts`: deep maroon `accent`/`maroon`, warm parchment `paper`, brass `brass`) evoking the line-art illustration at `public/branding/temple-illustration.jpg`. That image is a static design asset (not a `media_asset` a planner uploads) used as a tinted full-bleed backdrop (`.temple-backdrop` in `src/index.css`) behind the guest gate (`UnlockPage`) and as the Home hero's fallback when no hero photo has been uploaded — so the unbranded state still feels intentional rather than blank. `.temple-divider` is a small ornamental rule reused between sections in place of a plain border, including between `OnePage`'s sections.
- **Runtime theming (§5.9, `src/lib/theme.ts`):** `ink`/`paper`/`tileBg`/`tileBorder` are defined in `tailwind.config.ts` as `rgb(var(--color-x, <today's-RGB>) / <alpha-value>)` — Tailwind's documented idiom for making a palette color CSS-variable-backed while every existing opacity-modified class (`text-ink/70`, `bg-paper/95`, `border-tileBorder/10`, 55+ call sites) keeps working unchanged, falling back to today's exact colors when the variable is unset (`tileBorder`'s fallback is `ink`'s own RGB triplet, so `border-tileBorder/10` reproduces today's `border-ink/10` exactly). `fontFamily.display` is similarly `var(--font-site, <today's-serif-stack>)`. `useSiteTheme()` (called once, from `Layout`, which already calls `useSiteConfig()`) writes `--color-ink`/`--color-paper`/`--font-site`/`--color-tile-bg`/`--color-tile-border` to `document.documentElement` — not a scoped wrapper — because `bg-paper`/`text-ink` are applied on `<body>` (above any wrapper a scoped approach could use) and because `site_font_size` (`SMALL`/`MEDIUM`/`LARGE` → 15/16/18px) has no scoped alternative: Tailwind's `rem`-based sizing is always relative to `<html>`, never an ancestor. Since `Layout` only ever mounts inside the authenticated `GuestRoute`, this genuinely-global mutation still only takes effect post-authentication — `/unlock` never calls `useSiteConfig()` and stay on the fixed branded look, with a cleanup effect removing every property on unmount. A hex color setting is converted to the "R G B" triplet the `rgb()` function requires (`hexToRgbTriplet`) — feeding it a raw hex string would silently break every opacity-modified class site-wide, not just the one changed; an unparseable value returns `undefined` so the caller omits the variable entirely and Tailwind's own fallback applies, failing safe without backend format validation. Header styling (font color/size/background/family) doesn't go through CSS variables at all — applied as plain inline styles/classes on `<header>`/`<nav>`/each nav item (computed once by `useSiteTheme`), since the header has no existing opacity-modified classes to preserve.
- **Component library (`src/components/index.tsx`):** a small subset of the planner app's primitives — `ToastProvider`/`useToast`, `LoadingSpinner`, `ErrorMessage`, `PageHeading`, `PageBanner` — trimmed to what a read-mostly, unauthenticated-by-default app actually needs (no `Table`, `Modal`, or form inputs beyond what `UnlockPage` uses inline). `PageHeading` renders an `h1` by default and an `h2` inside `Section` (via a `HeadingLevelContext` `Section` provides) — so the same five page components emit correct heading levels whether they're a whole document (multi-page) or one of several sections on it (single-page), with no prop threaded through any of them. `Section` also carries the anchor `id` and the `scroll-mt-*` that clears the sticky header.
- **Forms:** the only forms are the two-step unlock flow; both use plain `useState`, matching the planner app's convention. `react-hook-form`/`zod` are intentionally not installed here (they're unused dead weight even in the planner app — see its design doc §6).

## 7. State Management and Data Fetching

All server state lives in TanStack Query (`src/api/hooks.ts`), same as the planner app:

- `useSiteConfig`, `useSchedule`, `useThingsToDo`, `useFaq`, `useTravelInfo` — one query hook per `GET /api/v1/guest/site/*` endpoint, no mutations (this app never writes). `usePageContent(slug)` is a small derived helper (not its own fetch) that looks up one `site_page` row out of `useSiteConfig`'s `pages` list — every dedicated page (Home, Schedule, Travel, Things To Do, FAQ) reads its own heading/body/image this way instead of duplicating the `.find(...)` call. `useSiteLayout()` and `useSectionPages()` are the same kind of derived helper for §5.8 — the site layout mode, and the (RSVP-excluded) page list `OnePage` renders as sections.
- `OnePage` calls all five content-list hooks itself (`useSchedule`/`useTravelInfo`/`useThingsToDo`/`useFaq` plus config) so it can gate a single `LoadingSpinner` on whichever are for currently-visible pages, before any of the (otherwise unmodified) page components mount and run their own — already-resolved — `isLoading` check. TanStack Query dedupes by key, so this costs no extra requests beyond what those pages already made individually in multi-page mode.
- No query invalidation is needed since nothing here mutates server state; `staleTime: 30_000` (set globally in `main.tsx`) is enough to avoid refetching on every tab switch within a session.
- `siteMediaUrl(id)` is a small helper, not a hook, that turns a `media_asset` id into `/api/v1/media/{id}` — the same unauthenticated image-read endpoint the planner app's media picker uses. `PageBanner` (`src/components/index.tsx`) wraps it into a full-width banner `<img>` above a page's heading, rendering nothing when the page has no image configured — used by Schedule, Travel, Things To Do, and generic content pages.

## 8. API Integration

`src/api/client.ts` mirrors the planner app's `client.ts` almost exactly (same `request<T>()` wrapper, same `ApiRequestError`, same `401` → `onUnauthorized` hook) with two differences: no `downloadCsv` (nothing here is exportable), and the unauthorized message reads "Please verify again" rather than "log in again," matching the guest vocabulary (there's no concept of a login screen here, only the verification handshake).

## 9. Authentication and Session Management

- The JWT returned by `POST /api/v1/guest/sessions` is stored in `localStorage` (`GuestAuthContext`), **not** kept memory-only like the planner app's token. This is a deliberate, documented deviation from the planner app's pattern (root design §5.8, §10): guest content is low-sensitivity (schedule/travel, not PII), guests are overwhelmingly on mobile, and they return to the site repeatedly over the months before the wedding — re-answering the verification question on every visit would be poor UX.
- A `401` is only treated as an expired session when the request actually carried a token. An unauthenticated `401` — a wrong verification answer — falls through to the generic error path in `api/client.ts`, so its message (which may explain that the next attempt will be refused) reaches the guest instead of being overwritten with a session-expiry notice.
- Session length is bounded by the backend's 30-day guest token expiry (`wedding.security.guest-session-minutes`); the frontend does not refresh it — an expired token surfaces as a `401` → `GuestAuthContext.logout()` → redirect to `/unlock`.
- `localStorage` (not `sessionStorage`) means a session survives closing the tab or app, which is the point; the cost is that a shared or lost device stays authenticated until the token expires. Acceptable for content with no PII in it.

## 10. Non-Functional Requirements

- Mobile-first by default (root design §9 doesn't distinguish devices, but the guest audience skews heavily toward phones checking a wedding site) — verified at a 375px viewport.
- Every page has an explicit loading state (`LoadingSpinner`) and an explicit error state (`ErrorMessage`); no page ever renders a blank area while data is missing.
- No client-side pagination or virtualization — schedule and travel lists are small (a handful of events/items per wedding) and fetched in full.
- Self-contained styling: no *external* webfont network dependency — the 10 optional custom fonts (§5.9) are bundled as static assets served by the same Nginx as everything else, not fetched from Google Fonts or any other third party, consistent with keeping the guest experience fast on mobile data. `fontFamily.display` defaults to a system serif stack when no custom font is chosen. A browser only fetches the one `@font-face` a planner actually selects (`font-display: swap` avoids invisible text while it loads), so bundling all 10 costs nothing beyond whichever one is in use.

## 11. Technology and Deployment

- **Framework:** React 18 + TypeScript, built with Vite.
- **Styling:** Tailwind CSS utility classes with a small custom palette/font extension (`tailwind.config.ts`) — unlike the planner app's empty `theme.extend`, since this app's visual identity (a wedding site, not an admin tool) actually needs one.
- **Data/server state:** `@tanstack/react-query` v5.
- **Routing:** `react-router-dom` v6.
- **Icons:** `lucide-react` (installed for consistency with the planner app; not currently used by any page).
- **Type checking as CI gate:** `npm run build` runs `tsc` before `vite build`, same convention as the planner app.
- **Local dev:** `npm run dev` serves on `:3001` and proxies `/api` to `PUBLIC_UI_API_BASE_URL` (default `http://localhost:8080`) per `vite.config.ts`.
- **Production (local Compose):** multi-stage `Dockerfile` — `npm ci && npm run build`, then `nginx:1.27-alpine` serves `dist/` and reverse-proxies `/api/` to the `api` service (`nginx.conf`), falling back unmatched routes to `index.html`. Compose service name `web-public`, host port `3001`.
- **Production (deployed):** built with `VITE_API_BASE_URL` set to the API's public hostname and deployed to Firebase Hosting (`firebase.json`, `guest` target) — see root `SYSTEM_DESIGN.md` §10. `nginx.conf`/`Dockerfile` above remain the Compose-dev path only.

## 12. Design Decisions and Edge Cases

- **`localStorage` over memory-only auth** (see §9) — the one deliberate divergence from the planner app's session pattern, driven by a different threat/UX tradeoff (low-sensitivity content, mobile-heavy audience) rather than an oversight.
- **Nav driven entirely by backend config**, not a hardcoded route list — adding/hiding a tab is a planner action (`site_page.visible`), not a frontend change. `/:slug` catches anything the nav can produce that isn't one of the five hand-built pages (Home, Schedule, Travel, Things To Do, FAQ).
- **No client-side source of truth for visibility.** The Schedule page trusts `GET /api/v1/guest/site/schedule` completely — it doesn't re-derive which events to show from any other data the app might have cached.
- **Separate app, not a mode of the planner app.** Different auth model (QR/verification vs. email/password), different audience (200 casual mobile visitors vs. 5 power users), and different failure tolerance (a guest should never see an internal error code) justified a fully separate package rather than a shared codebase with route-based mode switching.
- **Site layout as a stored setting, not a build flag.** A `VITE_`-style env var would need a rebuild/redeploy to flip and would put the choice in a developer's hands instead of the couple's; `site_settings.site_layout` (§5.8) matches every other guest-site presentation choice already living in the database.
- **The five page components are shared between layouts, not forked.** `OnePage` composes the exact same `HomePage`/`SchedulePage`/`TravelPage`/`ThingsToDoPage`/`FaqPage`/`ContentPage` used by the multi-page routes, via a `HeadingLevelContext` rather than a prop threaded through all of them. Duplicating them into dedicated "section" components was rejected — it guarantees the two layouts drift as content evolves, for a purely presentational (heading-level) difference.
- **RSVP always routed, never a section.** It's the one page a guest submits through rather than reads, and a form embedded mid-scroll fights the anchor/section scroll model the rest of single-page mode relies on.
- **The hash is never rewritten while scrolling.** `useActiveSection` tracks which section is in view purely in component state for nav highlighting; it does not call `pushState`/`replaceState` per section, which would either spam the Back button with every section the guest scrolled past, or (with `replaceState`) fight an in-flight smooth scroll and fire constantly during momentum scrolling on mobile. Consequence: scrolling and then refreshing returns to the top rather than the last-viewed section — an acceptable trade for sane history and no fixed-hash-per-scroll jank. The hash only changes from an explicit nav click (or a redirect/deep link).
- **No global `scroll-behavior: smooth`.** It would animate the *initial* landing scroll too — a cold deep link or a legacy-path redirect would visibly scroll past every section on the way to its target. `useHashScroll` decides smooth-vs-instant per navigation instead (see §6), and Home's hero, banner images, and cards all have fixed heights so a late-loading image can't shift the scroll target after the jump.
- **Flat `site_settings` columns for styling (§5.9), not one JSONB "theme" blob.** `GET /api/v1/guest/site/config` does `SELECT *` with no DTO — flat columns reach this app for free; a JSONB blob would need parse/shape code here too. `PATCH /api/v1/internal/site/settings` is a field-wise merge, not a whole-row replace, unlike `invitation_card_layout` (JSONB), which needed that shape for its cross-field orientation validation — these 8 fields have no cross-field structure to validate.
- **`document.documentElement` mutation for theming, not a scoped wrapper element.** `site_font_size` has no scoped alternative (`rem` is always relative to `<html>`); once that mutation is accepted, doing the color/font-family variables at the same root is one mechanism instead of two, and `bg-paper`/`text-ink` being applied on `<body>` rules out a wrapper div anyway. Scoping to "only after authentication" falls out of `Layout`'s mount lifecycle for free, rather than needing separate mount/cleanup logic.
- **`site_font_family` applies to headings only, not body text.** The 10 available fonts are decorative script faces with small x-heights — elegant for a couple's names or a page title, hard to read as dense paragraphs (schedule descriptions, FAQ answers). Raised as an explicit question rather than silently decided either way.
- **The active nav item's color overrides both states together, not just one.** When `header_font_color` is set, both the active and inactive nav item colors switch to it (active at full opacity plus the existing `bg-accent/10` tint, inactive at reduced opacity) rather than leaving the active state's color fixed at the built-in `accent` maroon — a fixed accent could go unreadable against a planner-chosen dark header background, and the two-state contrast structure (not `accent` itself, which isn't a customizable field) is what's worth preserving.
- **Fonts bundled as static assets, not uploaded through the media/upload pipeline.** The 10 fonts are a fixed, curated catalog (a zip the user supplied), not planner-authored content — `public/fonts/*.ttf` + `@font-face` follows the exact precedent already set by `public/branding/temple-illustration.jpg`, with zero backend/media involvement. Only Regular weight is bundled (the two Bold variants in the source zip are unused — nothing in the design renders bold display text).
